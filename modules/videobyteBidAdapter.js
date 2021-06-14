import {registerBidder} from '../src/adapters/bidderFactory.js';
import * as utils from '../src/utils.js';
import {VIDEO} from '../src/mediaTypes.js';

const BIDDER_CODE = 'videobyte';
const ENDPOINT_URL = 'https://x.videobyte.com/ortb'
const DEFAULT_BID_TTL = 30;
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_NET_REVENUE = true;
const VIDEO_ORTB_PARAMS = [
  'mimes',
  'minduration',
  'maxduration',
  'placement',
  'protocols',
  'startdelay',
  'skip',
  'skipafter',
  'minbitrate',
  'maxbitrate',
  'delivery',
  'playbackmethod',
  'api',
  'linearity'
];

export const spec = {
  code: BIDDER_CODE,
  aliases: ['vb'],
  supportedMediaTypes: [VIDEO],

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bidRequest The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function (bidRequest) {
    return validateVideo(bidRequest);
  },

  /**
   * Make a server request from the list of BidRequests.
   *
   * @param bidRequests - an array of bid requests
   * @return ServerRequest Info describing the request to the server.
   */
  buildRequests: function (bidRequests) {
    if (!bidRequests) {
      return;
    }
    return bidRequests.map(bidRequest => {
      const {params} = bidRequest;
      let publisherId = params.publisherId;
      if (bidRequest.params.video && bidRequest.params.video.e2etest) {
        utils.logMessage('E2E test mode enabled');
        publisherId = 'e2etest'
      }
      return {
        method: 'POST',
        url: ENDPOINT_URL + '/' + publisherId,
        data: JSON.stringify(buildRequestData(bidRequest)),
      }
    });
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {ServerResponse} serverResponse A successful response from the server.
   * @param bidRequest
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function (serverResponse, bidRequest) {
    const bidResponses = [];
    const response = (serverResponse || {}).body;
    // one seat  with (optional) bids for each impression
    if (response && response.seatbid && response.seatbid.length === 1 && response.seatbid[0].bid && response.seatbid[0].bid.length === 1) {
      const bid = response.seatbid[0].bid[0]
      let bidResponse = {
        requestId: response.id,
        cpm: bid.price,
        width: bid.w,
        height: bid.h,
        ad: bid.adm,
        ttl: DEFAULT_BID_TTL,
        creativeId: bid.crid,
        netRevenue: DEFAULT_NET_REVENUE,
        currency: DEFAULT_CURRENCY,
        mediaType: 'video',
        meta: {
          adomain: bid.adomain
        }
      };
      if (bid.adm) {
        bidResponse.vastXml = bid.adm;
      }

      bidResponses.push(bidResponse)
    } else {
      utils.logError('invalid server response received');
    }
    return bidResponses;
  },

}

// BUILD REQUESTS: VIDEO
function buildRequestData(bidRequest) {
  const {params, mediaTypes} = bidRequest;

  if (bidRequest.params.video && bidRequest.params.video.e2etest) {
    mediaTypes.video.playerSize = [[640, 480]]
    mediaTypes.video.conext = 'instream'
  }

  const video = {
    w: parseInt(mediaTypes.video.playerSize[0][0], 10),
    h: parseInt(mediaTypes.video.playerSize[0][1], 10),
  }

  // Obtain all ORTB params related video from Ad Unit
  VIDEO_ORTB_PARAMS.forEach((param) => {
    if (mediaTypes.video.hasOwnProperty(param)) {
      video[param] = mediaTypes.video[param];
    }
  });

  // Placement Inference Rules:
  // - If no placement is defined then default to 1 (In Stream)
  video.placement = video.placement || 2;

  // - If product is instream (for instream context) then override placement to 1
  if (params.context === 'instream') {
    video.startdelay = video.startdelay || 0;
    video.placement = 1;
  }

  // bid floor
  const bidFloorRequest = {
    currency: bidRequest.params.cur || 'USD',
    mediaType: 'video',
    size: '*'
  };
  let floorData = bidRequest.params
  if (utils.isFn(bidRequest.getFloor)) {
    floorData = bidRequest.getFloor(bidFloorRequest);
  }

  const openrtbRequest = {
    id: bidRequest.bidId,
    imp: [
      {
        id: '1',
        video: video,
        secure: isSecure() ? 1 : 0,
        bidfloor: floorData.floor,
        bidfloorcur: floorData.currency
      }
    ],
    site: {
      domain: window.location.hostname,
      page: window.location.href,
      ref: bidRequest.refererInfo ? bidRequest.refererInfo.referer || null : null
    }
  };

  // adding schain object
  if (bidRequest.schain) {
    utils.deepSetValue(openrtbRequest, 'source.ext.schain', bidRequest.schain);
  }

  // Attaching GDPR Consent Params
  if (bidRequest.gdprConsent) {
    utils.deepSetValue(openrtbRequest, 'user.ext.consent', bidRequest.gdprConsent.consentString);
    utils.deepSetValue(openrtbRequest, 'regs.ext.gdpr', (bidRequest.gdprConsent.gdprApplies ? 1 : 0));
  }

  // CCPA
  if (bidRequest.uspConsent) {
    utils.deepSetValue(openrtbRequest, 'regs.ext.us_privacy', bidRequest.uspConsent);
  }
  return openrtbRequest;
}

function validateVideo(bidRequest) {
  if (bidRequest.params && bidRequest.params.video && bidRequest.params.video.e2etest) {
    return true;
  }

  const mediaTypesVideo = bidRequest.mediaTypes.video;
  if (mediaTypesVideo === undefined) {
    return false;
  }

  if (!bidRequest.params.publisherId) {
    utils.logError('failed validation: publisher id not declared');
    return false;
  }

  if (!mediaTypesVideo.context) {
    utils.logError('failed validation: context id not declared');
    return false;
  }
  if (mediaTypesVideo.context !== 'instream') {
    utils.logError('failed validation: only context instream is supported ');
    return false;
  }

  if (typeof mediaTypesVideo.playerSize === 'undefined' || !Array.isArray(mediaTypesVideo.playerSize)) {
    utils.logError('failed validation: player size not declared');
    return false;
  }

  return true;
}

function isSecure() {
  return document.location.protocol === 'https:';
}

registerBidder(spec);
