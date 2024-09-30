const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const apiKey = "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f"; 

// Helper function to generate Authorization header
const getAuthHeader = () => {
  const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");
  return { Authorization: `Basic ${encodedAuth}` };
};

// Fetch all campaigns
const fetchCampaigns = async () => {
  const response = await axios.get(
    "https://api.woodpecker.co/rest/v1/campaign_list",
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Fetch campaign stats for a specific campaign
// const fetchCampaignStats = async (campaignId) => {
//   const response = await axios.get(
//     `https://api.woodpecker.co/rest/v1/campaign_list?id=${campaignId}`,
//     { headers: getAuthHeader() }
//   );
//   return response.data;
// };

// Classify leads based on stats
const classifyLeads = (campaignsData) => {
  const HotLeads = [];
  const WarmLeads = [];
  const ColdLeads = [];

  campaignsData.forEach((campaign) => {
    if (campaign?.stats?.length > 0) {
      const emails = campaign.stats[0]?.stats?.emails || [];
      emails.forEach((email) => {
        if (email.reply > 0) {
          if (!HotLeads.some((lead) => lead.id === email.id)) {
            HotLeads.push(email);
          }
        } else if (email.open > 0) {
          if (!WarmLeads.some((lead) => lead.id === email.id)) {
            WarmLeads.push(email);
          }
        } else {
          if (!ColdLeads.some((lead) => lead.id === email.id)) {
            ColdLeads.push(email);
          }
        }
      });
    }
  });

  return { HotLeads, WarmLeads, ColdLeads };
};

// API route to classify leads
app.get("/api/lead-classification", async (req, res) => {
  try {
    const campaignsData = await fetchCampaigns();
    const leads = classifyLeads(campaignsData);
    res.json(leads);
  } catch (error) {
    console.error("Error in lead classification:", error.message);
    res.status(500).json({ error: "Failed to classify leads" });
  }
});

// API route to fetch all campaigns
app.get("/api/campaigns", async (req, res) => {
  try {
    const campaigns = await fetchCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error.message);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// API route to fetch running campaigns and their stats
// app.get("/api/running-campaigns", async (req, res) => {
//   try {
//     const campaignsData = await fetchCampaigns();
    
//     // Use Promise.all to fetch all campaign stats concurrently
//     const campaignsWithStats = await Promise.all(
//       campaignsData.map(async (campaign) => {
//         const stats = await fetchCampaignStats(campaign.id);
//         return { ...campaign, stats };
//       })
//     );

//     res.json(campaignsWithStats);
//   } catch (error) {
//     console.error("Error fetching running campaigns:", error.message);
//     res.status(500).json({ error: "Failed to fetch running campaigns" });
//   }
// });

// const fetchCampaignStats = async (campaignId) => {
//   try {
//     const response = await axios.get(
//       `https://api.woodpecker.co/rest/v1/campaign_list?id=${campaignId}`,
//       { headers: getAuthHeader() }
//     );
//     return response.data;
//   } catch (error) {
//     if (error.response && error.response.status === 409) {
//       console.warn(`Conflict fetching stats for campaign ${campaignId}:`, error.response.data);
//       return null; // Return null for campaigns causing conflicts
//     }
//     throw error; // Re-throw other errors
//   }
// };

// app.get("/api/running-campaigns", async (req, res) => {
//   try {
//     const campaignsData = await fetchCampaigns();

//     const campaignsWithStats = await Promise.all(
//       campaignsData.map(async (campaign) => {
//         const stats = await fetchCampaignStats(campaign.id);
//         if (stats) { // Only include campaigns with valid stats
//           return { ...campaign, stats };
//         }
//         return null; // Skip this campaign if stats are unavailable
//       })
//     );

//     // Filter out null values (campaigns that returned 409 conflicts)
//     const validCampaigns = campaignsWithStats.filter((campaign) => campaign !== null);

//     res.json(validCampaigns);
//   } catch (error) {
//     console.error("Error fetching running campaigns:", error.message);
//     res.status(500).json({ error: "Failed to fetch running campaigns" });
//   }
// });

// Helper function to introduce a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchCampaignStatsWithThrottle = async (campaignId, delayTime = 500) => {
  try {
    const response = await axios.get(
      `https://api.woodpecker.co/rest/v1/campaign_list?id=${campaignId}`,
      { headers: getAuthHeader() }
    );
    await delay(delayTime); // Wait before sending the next request
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 409) {
      console.warn(`Conflict fetching stats for campaign ${campaignId}:`, error.response.data);
      return null; // Return null for campaigns causing conflicts
    }
    throw error; // Re-throw other errors
  }
};

app.get("/api/running-campaigns", async (req, res) => {
  try {
    const campaignsData = await fetchCampaigns();

    // Fetch stats for campaigns sequentially with throttling
    const campaignsWithStats = [];
    for (const campaign of campaignsData) {
      const stats = await fetchCampaignStatsWithThrottle(campaign.id);
      if (stats) {
        campaignsWithStats.push({
          ...campaign,
          stats,
        });
      }
    }

    res.json(campaignsWithStats);
  } catch (error) {
    console.error("Error fetching running campaigns:", error.message);
    res.status(500).json({ error: "Failed to fetch running campaigns" });
  }
});

// Start the server
app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
