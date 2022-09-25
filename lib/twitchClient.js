import axios from 'axios';

const TWITCH_API_URL= "https://api.twitch.tv/helix";

export class TwitchClient {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    async refreshTwitchAuthToken(refreshToken) {
        const authUrl = `https://id.twitch.tv/oauth2/token?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=refresh_token&refresh_token=${refreshToken}`
        const response = await axios.post(authUrl);
        if (response.status > 299) {
            console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
            return null;
        }
        return response.data.access_token;
    }

    async getCurrentChannelInfo(accessToken, broadcasterId) {
        const url = `${TWITCH_API_URL}/channels?broadcaster_id=${broadcasterId}`
        const response = await axios.get(url, {
            headers: {
                "Client-Id": this.clientId,
                "Authorization": `Bearer ${accessToken}`
            }
        });
        if (response.status > 299) {
            console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
            return null;
        }
        return response.data.data[0];
    }
}  
