# on-campus-counter

Based on the idea that all onCampus accesses will come from IP addresses contained in the private ranges (documented [here](https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces)), this middelware adds an `on_campus` field on each EC and increments the `on-campus-accesses` counter in the general report.
