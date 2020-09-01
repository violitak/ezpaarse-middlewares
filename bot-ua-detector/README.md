# bot-ua-detector

Mark ECs as robots if their user-agent string match a regex in the COUNTER robot list

## Headers

+ **robot-refresh-timeout** : Robot refresh time *(default: 5000ms)*

## Configuration

+ ezPAARSE-Middlewares : **bot-ua-detector**

### Example :

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: bot-ua-detector"
  -F "files[]=@access.log"
```