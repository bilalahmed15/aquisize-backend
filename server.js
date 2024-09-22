const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors()); // Enable CORS

// Function to fetch all campaigns
const fetchCampaigns = async () => {
  const apiKey =
    "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f"; // Replace with your actual API key
  const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");

  const response = await axios.get(
    "https://api.woodpecker.co/rest/v1/campaign_list",
    {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
      },
    }
  );

  return response.data;
};

// Function to fetch stats for a given campaign ID
const fetchCampaignStats = async (campaignId) => {
  const apiKey =
    "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f"; // Replace with your actual API key
  const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");

  const response = await axios.get(
    `https://api.woodpecker.co/rest/v1/campaign_list?id=${campaignId}`,
    {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
      },
    }
  );

  return response.data;
};

const classifyLeads = (campaignsData) => {
  const HotLeads = [];
  const WarmLeads = [];
  const ColdLeads = [];

  campaignsData.forEach((campaign) => {
    campaign.stats[0].stats.emails.forEach((email) => {
      if (email.reply > 0) {
        if (!HotLeads.some((lead) => lead.id === email.id)) {
          HotLeads.push(email);
        }
      } else if (email.open > 0 && email.reply < 1) {
        if (!WarmLeads.some((lead) => lead.id === email.id)) {
          WarmLeads.push(email);
        }
      } else if (email.open < 1 && email.reply < 1) {
        if (!ColdLeads.some((lead) => lead.id === email.id)) {
          ColdLeads.push(email);
        }
      }
    });
  });

  return { HotLeads, WarmLeads, ColdLeads };
};

app.get("/api/lead-classification", async (req, res) => {
  try {
    const campaignsData = await fetchCampaigns();

    const leads = classifyLeads(campaignsData);

    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/campaigns", async (req, res) => {
  try {
    const apiKey =
      "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f"; 
    const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");

    const response = await axios.get(
      "https://api.woodpecker.co/rest/v1/campaign_list",
      {
        headers: {
          Authorization: `Basic ${encodedAuth}`, 
        },
      }
    );

    res.json(response.data); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/running-campaigns", async (req, res) => {
  try {
    const campaignsData = await fetchCampaigns();
    // const runningCampaigns = campaignsData.filter(
    //   (campaign) => campaign.status === "RUNNING"
    // );

    const statsPromises = campaignsData.map(async (campaign) => {
      const stats = await fetchCampaignStats(campaign.id); 
      return {
        ...campaign,
        stats,
      };
    });

    const campaignsWithStats = await Promise.all(statsPromises);
    res.json(campaignsWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
