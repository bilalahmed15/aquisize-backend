const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
const apiKey =
  "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f";

// Helper function to generate Authorization header
const getAuthHeader = () => {
  const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");
  return { Authorization: `Basic ${encodedAuth}` };
};

const getAuthHeader1 = () => {
  const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");
  return { "X-API-Key": apiKey };
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
      console.warn(
        `Conflict fetching stats for campaign ${campaignId}:`,
        error.response.data
      );
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

app.post("/api/blacklist-domains", async (req, res) => {
  const { domains } = req.body;

  if (
    !Array.isArray(domains) ||
    !domains.every((domain) => typeof domain === "string")
  ) {
    return res
      .status(400)
      .json({ error: "Invalid input: domains should be an array of strings" });
  }

  try {
    const response = await axios.post(
      "https://api.woodpecker.co/rest/v2/blacklist/domains",
      { domains },
      // { headers: { ...getAuthHeader1(), 'Content-Type': 'application/json' } }
      {
        headers: {
          "X-API-Key":
            "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f",
        },
      }
    );

    res.json(response.data); // Respond with the data returned by the Woodpecker API
  } catch (error) {
    console.error("Error blacklisting domains:", error.message);

    // Handle errors returned by the Woodpecker API
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to blacklist domains" });
    }
  }
});

app.post("/api/delete-domains", async (req, res) => {
  const { domains } = req.body;
  console.log(req.body);

  if (
    !Array.isArray(domains) ||
    !domains.every((domain) => typeof domain === "string")
  ) {
    return res
      .status(400)
      .json({ error: "Invalid input: domains should be an array of strings" });
  }
  try {
    const response = await axios.delete(
      "https://api.woodpecker.co/rest/v2/blacklist/domains",
      {
        domains: [
          "baddomain.com",
          "blacklistedomain.io",
          "nomoreemails.co",
          "finisheddeal.co.uk",
          "notmyicp.design",
        ],
      },
      {
        headers: {
          "X-API-Key":
            "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error blacklisting domains:", error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to blacklist domains" });
    }
  }
});
// Start the server
app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
