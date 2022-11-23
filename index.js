import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Validator } from 'jsonschema';
import { TwitchClient } from './lib/twitchClient.js';
import { UserDao } from './lib/dao.js';
import { TwitterClient } from './lib/twitterClient.js';

const AUTH_SECRET = process.env.AUTH_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

const APP_PORT = process.env.APP_PORT || 8080;
const DEPLOYED = process.env.DEPLOYED || false;
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_STATE_TTL = process.env.TWITTER_STATE_TTL || 5*60*1000;
const TWITTER_REDIRECT_URL = process.env.TWITTER_REDIRECT_URL || `http://localhost:${APP_PORT}/user/twitterLoginResponse`;
const VALID_TWITTER_IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/gif"];
const TWITTER_IMAGE_UPLOAD_LIMITS = {
  "image/png": 5*1000*1000,
  "image/jpeg": 5*1000*1000,
  "image/gif": 15*1000*1000
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_EVENT_SUB_SECRET = process.env.TWITCH_EVENT_SUB_SECRET;
const TWITCH_STATE_TTL = process.env.TWITCH_STATE_TTL || 5*60*1000;
const TWITCH_REDIRECT_URL = process.env.TWITCH_REDIRECT_URL || `http://localhost:${APP_PORT}/twitchLoginResponse`;

const POSTGRES_HOST = process.env.POSTGRES_HOST
const POSTGRES_PORT = process.env.POSTGRES_PORT
const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD
const POSTGRESS_DATABASE = process.env.POSTGRESS_DATABASE

const GO_LIVE_TEXT_LIMIT = process.env.GO_LIVE_TEXT_LIMIT || 2048;

const userDao = new UserDao(POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USERNAME, POSTGRES_PASSWORD, POSTGRESS_DATABASE);

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
    "altText": "Daruuu from Stein's Gate sits hunched over his keyboard, the scene lit only by the light of the monitor. Hits very close to home."
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
const twitterClient = new TwitterClient(TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_STATE_TTL, TWITTER_REDIRECT_URL);

const twitchClient = new TwitchClient(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_EVENT_SUB_SECRET, TWITCH_REDIRECT_URL, TWITCH_STATE_TTL);
const jsonValidator =  new Validator();
const imageUploadSchema = {
  "id": "/uploadImages",
  "type": "array",
  "items": {
    "properties": {
      "id": {"type": "string"},
      "url": {"type": "string"},
      "altText": {"type": "string"},
    },
    "required": ["url"]
  }
}

const app = express();

app.use([
  express.raw({ type: 'application/json'}), // Need raw message body for signature verification,
]);

app.use(session({
  saveUninitialized: false,
  resave: false,
  secret: SESSION_SECRET,
  proxy: DEPLOYED,
  cookie: {
    httpOnly: DEPLOYED,
    secure: DEPLOYED,
    sameSite: true
  }
}));

const whitelist = ['https://golive.codingvibe.dev']
if (!DEPLOYED) {
  whitelist.push('http://localhost:3000', 'http://localhost:8080', undefined);
}

var corsOptions = {
  origin: function (origin, callback) {
    console.log(`origin: ${origin}`)
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}
app.use(cors(corsOptions));

const authEndpoints = express.Router();
app.use('/user', authEndpoints);

const server = http.createServer(app);
server.listen(APP_PORT);

/*
TODO FOR PUBLIC CONSUMPTIONS
- Add retries for failures
  - Processing queue?

Stretch?
- Add Discord
*/

app.get('/twitterLogin', async(_, res) => {
  const twitterLoginUrl = twitterClient.getAuthUrl();
  res.redirect(twitterLoginUrl);
});

app.get('/twitchLogin', async(_, res) => {
  // Potential optimization: If session token exists and is valid,
  // return a 204, so the front end doesn't go through the auth flow.
  const twitchLoginUrl = twitchClient.getLoginUrl();
  res.redirect(twitchLoginUrl);
});

app.get('/twitchLoginResponse', async (req, res) => {
  const state = req.query.state;
  if (!state) {
    res.status(401).send({"error": "No Twitch state supplied"});
    return;
  }
  if (!twitchClient.isStateValid(state)) {
    res.status(401).send({"error": "Unrecognized or expired Twitch state"});
    return;
  }

  const err = req.query.error;
  if (err) {
    const errDesc = decodeURIComponent(req.query.error_description);
    console.error(`${err}: ${errDesc}`);
    res.status(204);
    return;
  }  

  const code = req.query.code;
  const tokens = await twitchClient.getTokens(code, state);
  const twitchUser = await twitchClient.getUser(tokens.accessToken);

  const userConnections = await userDao.getUserConnections(twitchUser.login);
  if (!userConnections) {
    await userDao.createNewUser(twitchUser.login, tokens.refreshToken);
  } else {
    for (let i = 0; i < userConnections.length; i++) {
      if (userConnections[i].type == "twitch") {
        userConnections[i].refreshToken = tokens.refreshToken;
      }
    }
    await userDao.setUserConnections(twitchUser.login, userConnections);
  }

  const hasGoLiveEventSub = await twitchClient.hasGoLiveEventSub(twitchUser.id)
  if (!hasGoLiveEventSub) {
    await twitchClient.createGoLiveEventSub(twitchUser.id);
  }

  const signedJwt = jwt.sign( {
    "twitchLogin": twitchUser.login
  }, AUTH_SECRET, { expiresIn: 30*60, issuer: "codingvibe" });

  req.session.token = signedJwt;
  req.session.save((err) => {
    if (err) {
      console.error(err);
      res.status(500).send('There was an error authenticating the user.');
    } else {
      res.status(200).send(signedJwt);
    }
  });
});

function getToken(req) {
  if (req.session?.token) {
    return req.session?.token;
  }
  const cookieArr = req.headers.cookie?.split(';');
  const cookieMap = {};
  for (const cookie of cookieArr) {
    const split = cookie.trim().split('=');
    cookieMap[split[0]] = split[1];
  }
  return cookieMap['token'];
}

authEndpoints.use((req, res, next) => {
  const token = getToken(req);
  if (!token) {
    res.sendStatus(401); 
    return;
  }
  try {
    jwt.verify(token, AUTH_SECRET, { issuer: "codingvibe"});
    next();
  } catch (e) {
    console.error(e);
    res.sendStatus(401);
  }
});

authEndpoints.get('/loggedIn', async(req, res) => {
  res.sendStatus(200);
});

authEndpoints.get('/connections', async(req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  const userConnections = await userDao.getUserConnections(twitchLogin);
  const platforms = userConnections.map(connection => connection.type).filter(platform => platform != "twitch");
  res.send(platforms);
});

authEndpoints.delete('/connections', async (req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  const platformToRemove = req.query.platform;
  const userConnections = await userDao.getUserConnections(twitchLogin);
  const newPlatforms = userConnections.filter(platform => !(platformToRemove == platform.type));
  await userDao.setUserConnections(twitchLogin, newPlatforms);
  if (platformToRemove == "twitch") {
    delete getToken(req);
  }
  res.sendStatus(204);
});

authEndpoints.get('/goLiveText', async(req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  const goLiveText = await userDao.getGoLiveText(twitchLogin);
  if (!goLiveText) {
    res.sendStatus(404);
    return;
  }
  res.send({
    "goLiveText": goLiveText
  });
});

authEndpoints.put("/goLiveText", async (req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  const reqBody = JSON.parse(req.body);
  if (!reqBody || !reqBody.goLiveText) {
    res.sendStatus(400);
    return;
  } else if (reqBody.goLiveText.length > GO_LIVE_TEXT_LIMIT) {
    res.status(400).send({"error": `Go live text exceeds character limit ${GO_LIVE_TEXT_LIMIT}`});
    return;
  }
  await userDao.setGoLiveText(twitchLogin, reqBody.goLiveText);
  res.sendStatus(200);
});

authEndpoints.get('/images', async (req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  const images = await userDao.getImages(twitchLogin);
  res.send(images);
});

authEndpoints.post('/images', async (req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  try {
    const images = JSON.parse(req.body);
    if (!(images instanceof Array) || images.length == 0 ||
        !jsonValidator.validate(images, imageUploadSchema).valid) {
      res.status(400).send({"error": "Bad image post body"});
      return;
    }
    // This is probably too clever for my own good.
    const invalidImages = (await Promise.all(images.map(image => image.url)
                                .map(async (image) => isInvalidImage(image))))
                                .map((invalid, index) => invalid ? images[index].url : null)
                                .filter(imageUrl => imageUrl != null);
    if (invalidImages.length > 0) {
      res.status(400).send({"error": `Invalid images detected. Either too big or bad content type on ${invalidImages.join(", ")}`});
      return;
    }
    await userDao.addImages(twitchLogin, images);
    res.sendStatus(200);
  } catch(e) {
    console.error("Bad post body", e);
    res.status(400).send({"error": "Malformed JSON"}); 
  }
});

authEndpoints.put("/images", async (req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  try {
    const images = JSON.parse(req.body);
    if (!(images instanceof Array) || images.length == 0 ||
        !jsonValidator.validate(images, imageUploadSchema).valid) {
      res.status(400).send({"error": "Bad image post body"});
      return;
    }
    console.log(images);
    // This is probably too clever for my own good.
    const invalidImages = (await Promise.all(images.map(image => image.url)
                                .map(async(image) => isInvalidImage(image))))
                                .map((invalid, index) => invalid ? images[index].url : null)
                                .filter(imageUrl => imageUrl != null);
    if (invalidImages.length > 0) {
      res.status(400).send({"error": `Invalid images detected. Either too big or bad content type on ${invalidImages.join(", ")}`});
      return;
    }
    const dbImages = await userDao.getImages(twitchLogin);
    const dbImageMap = dbImages.reduce((obj, item) => (obj[item.id] = item, obj) ,{});
    const newImages = [];
    const updatedImages = [];

    images.filter(image => {
      return !image.id || !(image.id in dbImageMap) ||
              image.altText != dbImageMap[image.id].altText ||
              image.url != dbImageMap[image.id].url
    }).forEach(image => {
      if (image.id && image.id in dbImageMap) {
        updatedImages.push(image);
      } else {
        newImages.push(image);
      }
    });

    const imageMap = images.reduce((obj, item) => (obj[item.id] = item, obj) ,{});
    const deletedImages = dbImages.filter(image => !(image.id in imageMap));
    if (newImages.length > 0) {
      await userDao.addImages(twitchLogin, newImages);
    }
    if (updatedImages.length > 0) {
      await userDao.updateImages(twitchLogin, updatedImages)
    }
    if (deletedImages.length > 0) {
      await userDao.removeImages(twitchLogin, deletedImages);
    }
    res.sendStatus(201);
  } catch(e) {
    console.error("Bad post body", e);
    res.status(400).send({"error": "Malformed JSON"}); 
  }
});

authEndpoints.delete('/images/:imageId', async (req, res) => {
  const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
  const imageId = req.params.imageId;
  await userDao.removeImage(twitchLogin, imageId);
  res.sendStatus(200);
});

authEndpoints.get('/twitterLoginResponse', async (req, res) => {
  const state = req.query.state;
  const code = req.query.code;
  try {
    const tokens = await twitterClient.getAuthTokens(state, code);
    const { twitchLogin } = jwt.verify(getToken(req), AUTH_SECRET, { issuer: "codingvibe"});
    
    const userConnections = await userDao.getUserConnections(twitchLogin);
    if (!userConnections) {
      res.status(404).send({"error": "Unable to find Twitch user"});
      return;
    } else {
      let found = false;
      for (let i = 0; i < userConnections.length; i++) {
        if (userConnections[i].type == "twitter") {
          userConnections[i].refreshToken = tokens.refreshToken;
          found = true;
          break;
        }
      }
      if (!found) {
        userConnections.push({
          "type": "twitter",
          "refreshToken": tokens.refreshToken
        });
      }
      await userDao.setUserConnections(twitchLogin, userConnections);
    }
  } catch (e) {
    console.error(e);
    res.status(401).send({"error": "Unable to authenticate login response"});
    return;
  }
  res.sendStatus(200);
});

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
            const userConnections = await userDao.getUserConnections(broadcasterName);
            if (!userConnections) {
              console.error(`Unable to fetch user connections for ${broadcasterName}`);
              res.sendStatus(204);
              return;
            }
            const image = await userDao.getRandomImage(broadcasterName);
            const twitchRefreshToken = getRefreshToken(userConnections, "twitch");
            const { accessToken, refreshToken } = await twitchClient.refreshTwitchAuthToken(twitchRefreshToken);
            await setRefreshToken(broadcasterName, userConnections, "twitch", refreshToken);
            const streamInfo = await twitchClient.getCurrentChannelInfo(accessToken, broadcasterId);
            const goLiveTextTemplate = await userDao.getGoLiveText(broadcasterName);
            const goLiveText = fillOutTemplate(goLiveTextTemplate, streamInfo, broadcasterName);
            for(const connection of userConnections){
              switch(connection.type) {
                case "twitter":
                  await createTweet(connection.refreshToken, broadcasterName, goLiveText, image);
                  break;
                case "twitch":
                  // do nothing
                  break;
              }
            }
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

function fillOutTemplate(goLiveTextTemplate, streamInfo, twitchName) {
  return goLiveTextTemplate
            ?.replace("{{streamTitle}}", streamInfo.title)
            ?.replace("{{twitchName}}", twitchName);
}

async function createTweet(refreshToken, twitchName, tweetText, image) {
  const imageUrl = (image && image.url) ? image.url : null;
  const altText = (image && image.altText) ? image.altText : null;
  const newRefreshToken = await twitterClient.createTweet(refreshToken, tweetText, imageUrl, altText);
  if (newRefreshToken) {
    await userDao.updateRefreshToken(twitchName, "twitter", newRefreshToken);
    console.log(`Created tweet for ${twitchName} using image ${imageUrl} with text ${tweetText}`);
  }
}

function getRefreshToken(userConnections, platform) {
  return userConnections
    .filter(connection => connection.type == platform)
    .map(connection => connection.refreshToken);
}

async function setRefreshToken(twitchName, userConnections, platform, refreshToken) {
  for (let i = 0; i < userConnections.length; i++) {
    if (userConnections[i].type == platform) {
      userConnections[i].refreshToken = refreshToken;
    }
  }
  return await userDao.setUserConnections(twitchName, userConnections);
}

async function isInvalidImage(imageUrl) {
  const resp = await fetch(imageUrl, {
    'method': 'HEAD'
  });
  const contentType = resp.headers.get("content-type");
  const contentLength = resp.headers.get("content-length");
  if (!VALID_TWITTER_IMAGE_MEDIA_TYPES.includes(contentType)) {
    console.error(`invalid format ${contentType}`)
    return true;
  }
  if (contentLength && TWITTER_IMAGE_UPLOAD_LIMITS[contentType] < contentLength) {
    console.error(`invalid size ${contentLength}`)
    return true;
  }
  return false;
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