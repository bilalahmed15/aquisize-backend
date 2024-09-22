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
app.get("/api/campaigns", async (req, res) => {
  try {
    // Your API key in the username field
    const apiKey =
      "493261.90757bd644771a813c0aa7a88460e1fda7ad09f4300776faba6a4f47492aa49f"; // Replace with your actual API key
    // Base64 encode the key followed by a colon (indicating empty password)
    const encodedAuth = Buffer.from(`${apiKey}:`).toString("base64");

    const response = await axios.get(
      "https://api.woodpecker.co/rest/v1/campaign_list",
      {
        headers: {
          Authorization: `Basic ${encodedAuth}`, // Correctly formatted Basic Auth header
        },
      }
    );

    res.json(response.data); // Send the data back to the frontend
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Endpoint to get running campaigns with their stats
app.get("/api/running-campaigns", async (req, res) => {
  try {
    const campaignsData = await fetchCampaigns();
    // const runningCampaigns = campaignsData.filter(
    //   (campaign) => campaign.status === "RUNNING"
    // );

    const statsPromises = campaignsData.map(async (campaign) => {
      const stats = await fetchCampaignStats(campaign.id); // Assuming `id` is the campaign ID
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
