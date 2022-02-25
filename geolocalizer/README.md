# geocalizer

Geolocalize consultation events based on an IP address

## Headers
+ **Geoip** : Geolocation data that can be added to the results.

By default: ``geoip-longitude``, ``geoip-latitude``, ``geoip-country``

+ ``all`` can be used to include all possible fields
+ ``none`` to deactivate the geolocation.

The available fields are:

+ ``geoip-host``: IP address being geolocalized
+ ``geoip-country`` 2 characters code indicating the country (eg: ``FR`` for ``France``)
+ ``geoip-region``: 2 characters code indicating the region (eg: ``A8`` for ``Île-de-France``)
+ ``geoip-city``: complete name of the city (eg: ``Paris``)
+ ``geoip-latitude``: self-explanatory
+ ``geoip-longitude``: self-explanatory
+ ``geoip-coordinates``: concatenation of latitude and longitude between brackets (eg: ``[48.8592,2.3417]``)

### Examples


```bash
curl -v -X POST http://localhost:59599
    -H 'Geoip: all' \
    -F "file=@test/dataset/geolocalize.log"
```

Advanced usage example:

This example uses the ''csv2geojson'' and ''geojsonio-cli'' librairies.

```bash
npm install csv2geojson geojsonio-cli
```

It is then possible to directly visualize the results on a map.

```bash
curl -X POST http://127.0.0.1:59599 \
  --proxy "" \
  --no-buffer \
  --data-binary @./test/dataset/edp.2013-01-23.log  \
  -H 'Geoip: geoip-latitude, geoip-longitude' \
  -H 'Output-Fields: -doi,-identd,-url,-status,-size,+datetime' \
  | csv2geojson --lat "geoip-latitude" --lon "geoip-longitude" --delimiter ";" 2> /dev/null \
  | geojsonio
```

That opens a web browser with the following graphical representation of the access events.
##### Video Demonstration

This [screencast](https://www.youtube.com/watch?v=SXSIb7oczbI) demonstrates the previous usage (ie geolocation information visualized on a map)
