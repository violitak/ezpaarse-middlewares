# on-campus-counter

This middleware adds an `on_campus` field containing `Y` or `N` depending on the IP contained in the `host` field. It also increments two counters in the report : `on-campus-accesses` and `off-campus-accesses`.

By default, only [private IPv4 addresses](https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces) are considered on-campus. More ranges can be added by providing an `onCampusCounter` key in the ezPAARSE configuration (`config.local.json`).

`onCampusCounter` should be an array, where each element is either a valid range string, or an object with a string property `label` and an array property `ranges` containing valid range strings.

When a range is associated with a label, `on_campus` will contain the label instead of `Y`.

## Examples

```json
{
  "onCampusCounter": [
    "115.0.0.0/8",
    {
      "label": "Campus name",
      "ranges": ["93.25.0.0/16", "118.0.0.0/8"]
    }
  ]
}
```
