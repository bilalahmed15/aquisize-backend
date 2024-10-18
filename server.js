const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
const apiKey = "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f";

// Helper function to generate Authorization header
const getAuthHeader = () => {
  const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");
  return {
    Authorization: `Basic ${encodedAuth}`,
    "X-API-Key": apiKey,
  };
};

// Fetch all campaigns
const fetchCampaigns = async () => {
  const response = await axios.get(
    "https://api.woodpecker.co/rest/v1/campaign_list",
    { headers: getAuthHeader() }
  );
  return response.data;
};

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

// Throttling delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch campaign stats with throttling
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
      console.warn(
        `Conflict fetching stats for campaign ${campaignId}:`,
        error.response.data
      );
      return null; // Return null for campaigns causing conflicts
    }
    throw error; // Re-throw other errors
  }
};

// API route to fetch running campaigns
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

// API route to blacklist domains
app.post("/api/blacklist-domains", async (req, res) => {
  const { domains } = req.body;

  if (!Array.isArray(domains) || !domains.every((domain) => typeof domain === "string")) {
    return res.status(400).json({ error: "Invalid input: domains should be an array of strings" });
  }

  try {
    const response = await axios.post(
      "https://api.woodpecker.co/rest/v2/blacklist/domains",
      { domains },
      {
        headers: {
          "X-API-Key": apiKey,
        },
      }
    );

    res.json(response.data); // Respond with the data returned by the Woodpecker API
  } catch (error) {
    console.error("Error blacklisting domains:", error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to blacklist domains" });
    }
  }
});

// API route to delete domains
app.post("/api/delete-domains", async (req, res) => {
  const { domains } = req.body;

  if (!Array.isArray(domains) || !domains.every((domain) => typeof domain === "string")) {
    return res.status(400).json({ error: "Invalid input: domains should be an array of strings" });
  }

  try {
    const response = await axios.delete(
      "https://api.woodpecker.co/rest/v2/blacklist/domains",
      {
        headers: {
          "X-API-Key": apiKey,
        },
        data: { domains }, // Send domains in the request body
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error deleting domains:", error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to delete domains" });
    }
  }
});

// Function to fetch campaign stats for a specific day
const fetchCampaignStatsForDay = async (campaignId, date) => {
  try {
    const response = await axios.get(
      `https://api.woodpecker.co/rest/v1/campaign/${campaignId}/stats`,
      {
        headers: getAuthHeader(),
        params: { date: date },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching campaign stats:', error.message);
    return null; // Handle error appropriately
  }
};

// API route to fetch campaign stats for a specific day
app.get("/api/campaign-stats/:id", async (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // Use query parameters for the date

  if (!date) {
    return res.status(400).json({ error: "Please provide a date in the format YYYY-MM-DD" });
  }

  try {
    const stats = await fetchCampaignStatsForDay(id, date);
    if (stats) {
      res.json(stats);
    } else {
      res.status(404).json({ error: "No stats found for the specified date" });
    }
  } catch (error) {
    console.error("Error fetching campaign stats:", error.message);
    res.status(500).json({ error: "Failed to fetch campaign stats" });
  }
});

// Start the server
app.listen(4848, () => {
  console.log("Server is running on port 4848");
});
