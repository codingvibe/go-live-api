import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { TwitterApi } from 'twitter-api-v2';
import { TwitchClient } from './lib/twitchClient.js';

const APP_PORT = process.env.APP_PORT || 8080;
const DEPLOYED = process.env.DEPLOYED || false;
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN;
const TWITCH_EVENT_SUB_SECRET = process.env.TWITCH_EVENT_SUB_SECRET;

const ANIME_GIFS = [
  {
    "url": "https://c.tenor.com/u85_yodXikMAAAAC/anime-hands.gif",
    "altText": "Yuki Nagato from The Melancholy of Haruhi Suzumiya typing on a keyboard with great speed and dexterity. A true inspiration to typists everywhere."
  },
  {
    "url": "https://i.giphy.com/media/LHZyixOnHwDDy/giphy.gif",
    "altText": "Chi, the kitten from Chi's Sweet Home, is banging on the keyboard exactly like you would imagine a kitten would. It's very cute."
  },
  {
    "url": "https://i.gifer.com/YnA.gif",
    "altText": "This normal looking guy from Ghost in the Shell splits his fingies into many smaller, metal fingies and types like a madman. It's honestly disturbing."
  },
  {
    "url": "https://64.media.tumblr.com/ed74d501c90b6e63583a62eeadc7608e/tumblr_inline_pqa2ropw4W1v7wsso_1280.gif",
    "altText": "Xion from Kingdom Hearts types on a computer, then says 'Got it!'"
  },
  {
    "url": "https://64.media.tumblr.com/c43afb27a895e14c9dad617859385419/tumblr_inline_pqa2rps4KR1v7wsso_1280.gif",
    "altText": "Roxas from Kingdom Hearts is disrespectfully destroying a computer with his Keyblade. Very cringe of him."
  },
  {
    "url": "https://media0.giphy.com/media/l3vRmVv5P01I5NDAA/giphy.gif",
    "altText": "Edward from Cowboy Bebop flails their arms about while surfing the future internet. Jet is not pleased."
  },
  {
    "url": "https://i.imgur.com/5ErEY73.gif",
    "altText": "Kintaro Oe from Golden Boy learns how to type on a keyboard made of paper."
  },
  {
    "url": "https://media3.giphy.com/media/6rHfF5HqcnQpq/giphy.gif",
    "altText": "Luna, the black cat from Sailor Moon, looks upset at an old CRT monitor with white text on a blue background. No doubt her small cat eyes hurt."
  },
  {
    "url": "http://25.media.tumblr.com/bef9c3ef24707fbabf115f3267b7479d/tumblr_mom5j0GA1v1rc93aro1_500.gif",
    "altText": "Kenji Koiso from the movie Summer Wars frantically types on a keyboard. He's just solved a very hard math puzzle. It was impressive."
  },
  {
    "url": "https://camo.githubusercontent.com/4561c104ee04f0f66a83f1b8e3b6cbd4e7f6c5c6324688545cfc0232c525dfe1/68747470733a2f2f692e70696e696d672e636f6d2f6f726967696e616c732f66332f62382f36332f66336238363333656633366266306235303835633564306636303230633931392e676966",
    "altText": "An anime person with nice nails hits the delete key over and over again."
  },
  {
    "url": "https://media4.giphy.com/media/bi6RQ5x3tqoSI/giphy.gif",
    "altText": "A monitor from Code Geass displays some hex data while scrolling down before an ominous 'Error' message appears."
  },
  {
    "url": "https://assets.website-files.com/622a260c6d1af1d0042f8daf/62bf2ad830f59188e7bae00e_codinganime%20(1).gif",
    "altText": "A programmer from Stein's Gate sits hunched over his keyboard, the scene lit only by the light of the monitor. Hits very close to home."
  },
  {
    "url": "https://i.makeagif.com/media/5-25-2022/jLzbVG.gif",
    "altText": "A clip from Krazam's video on senior software engineers. The engineer is staring into code floating in front of him and his mustache is somehow also now code."
  }
]

// Twitch Event Sub Notification request headers
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase()
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

// Prepend this string to the HMAC that's created from the message
const HMAC_PREFIX = 'sha256=';

// Twitch Event Sub Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

// Twitch Event Sub Notification subscription types
const STREAM_ONLINE = "stream.online";

/////////////////////////// Set Up Server ///////////////////////////
const twitterClient = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_SECRET,
});

const twitchClient = new TwitchClient(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);

const app = express();

app.use([
  express.raw({ type: 'application/json'}), // Need raw message body for signature verification
]);

let server;
if (DEPLOYED) {
  const privateKey = fs.readFileSync('/etc/letsencrypt/live/twitchbotapi.codingvibe.dev/privkey.pem');
  const certificate = fs.readFileSync('/etc/letsencrypt/live/twitchbotapi.codingvibe.dev/fullchain.pem');

  const credentials = {key: privateKey, cert: certificate};
  server = https.createServer(credentials, app);
  server.listen(APP_PORT);
} else {
  server = http.createServer(app);
  server.listen(APP_PORT);
}

/*
TODO FOR PUBLIC CONSUMPTION
- Get this on a server
- Set up user database for tokens
- Do Twitter auth flow
  - save refresh token
- Do Twitch auth flow
  - save refresh token
- Add EventSub subscription when first Twitch auth flow happens
- Modify existing flow to use dynamic creds
- Remove static creds from .env file
- Design and implement a UI
  - First log in with Twitch
  - Check if connected already
  - If not, add Twitter button for auth
  - Receive callback, exchange for tokens, save in db
- Support adding of image URLs and alt text
- Get media type from media retrieval call
- Add retries for failures
  - Processing queue?

Stretch?
- Add Discord
*/

app.post('/eventsub', async (req, res) => {
  let hmac = HMAC_PREFIX + getHmac(TWITCH_EVENT_SUB_SECRET, req);

  if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
    let notification = JSON.parse(req.body);

    if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
      if (notification && notification.subscription) {
        switch (notification.subscription.type) {
          case STREAM_ONLINE:
            const broadcasterId = notification.event.broadcaster_user_id;
            const broadcasterName = notification.event.broadcaster_user_login;
            const accessToken = await twitchClient.refreshTwitchAuthToken(TWITCH_REFRESH_TOKEN)
            const streamInfo = await twitchClient.getCurrentChannelInfo(accessToken, broadcasterId);
            const title = `${streamInfo.title} https://twitch.tv/${broadcasterName}`;
            const gif = getRandomGif();
            console.log(`Created tweet for ${broadcasterName} using image ${gif.url} with text ${title}`);
            break;
          default:
            //do nothing;
        }
      }
      res.sendStatus(204);
    }
    else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
      res.status(200).send(notification.challenge);
    }
    else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
      res.sendStatus(204);

      console.log(`${notification.subscription.type} notifications revoked!`);
      console.log(`reason: ${notification.subscription.status}`);
      console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
    }
    else {
      res.sendStatus(204);
      console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
    }
  }
  else {
      console.log('403');    // Signatures didn't match.
      res.sendStatus(403);
  }
});

function getRandomGif() {
  return ANIME_GIFS[Math.floor(Math.random()*ANIME_GIFS.length)]
}

async function createTweet(twitterClient, message, image, altText) {
  if (image) {
    const data = await fetch(image);
    const blob = await (await data.blob()).arrayBuffer();
    const mediaId = await twitterClient.v1.uploadMedia(Buffer.from(blob), { mimeType: "image/gif" });
    await twitterClient.v1.createMediaMetadata(mediaId, { alt_text: { text: altText } });
    return await twitterClient.v1.tweet(message, { media_ids: [ mediaId ] });
  } else {
    return await twitterClient.v2.tweet(message);
  }
}

// Get the HMAC.
function getHmac(secret, request) {
  const message = (request.headers[TWITCH_MESSAGE_ID] + 
      request.headers[TWITCH_MESSAGE_TIMESTAMP] + 
      request.body)
  return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

 // Verify whether your signature matches Twitch's signature.
function verifyMessage(hmac, verifySignature) {
  if (!hmac || !verifySignature) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}