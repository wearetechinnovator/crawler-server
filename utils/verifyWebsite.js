const axios = require("axios");

const verifyWebsite = async (url) => {
    try {
        const response = await axios.get(`${url}/ai_crawl.json`);
        return response.status === 200;
    } catch (error) {
        console.error(`Error verifying website: ${error.message}`);
        return false;
    }

}

module.exports = {
    verifyWebsite
}