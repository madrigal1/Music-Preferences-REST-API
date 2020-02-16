const fetch = require("node-fetch");

const getApiData = async (url, settings) => {
  const response = await fetch(url, settings);
  const data = await response.json();
  return data;
};

module.exports = getApiData;
