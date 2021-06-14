# Overview

```
Module Name: VideoByte Bidder Adapter
Module Type: Bidder Adapter
Maintainer: prebid@videobyte.com
```

# Description

Module that connects to VideoByte's demand sources

*Note:* The Video SSP ad server will respond with an VAST XML to load into your defined player.


# Test Parameters
```
var adUnits = [
    {
      code: 'video-1',
      mediaTypes: {
        video: {
          context: "instream",
          playerSize: [[640, 480]],
          mimes: ['video/mp4'],
        }
      },
      bids: [
        {
          bidder: 'videobyte',
          params: {
            video: {
              e2etest: true
            }
          }
        }
      ]
    }
]
```
