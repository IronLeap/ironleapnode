# Iron Leap Node

Node.js SDK middleware that sends API data to Iron Leap.
This SDK supports Express and Nest.js.

## Notes
To ensure req body is captured, if you use a body parser middleware like `body-parser`, apply the middleware after it.

## How to install

```shell
npm install --save ironleapnode
```

## How to use

### 1. As middleware:

```javascript

// 1. Import Modules
var express = require('express');
var app = express();
var ironleapnode = require('ironleapnode');

// 2. Set the options, the only required field is applicationId.
var options = {
  appKey: 'App key',
  logBody: true,
  ironleapUrl: 'https://analytics.ironleap.io/api/collect',
};

// 3. Initialize the middleware object with options
var ironleapMiddleware = ironleapnode(options);

// 4. Use the middleware to capture incoming API Calls.
// If you have a body parser middleware, apply this middleware after any body parsers.
app.use(ironleapMiddleware);

```

### 2. In createServer

```javascript
var ironleapnode = require('ironleapnode');
const http = require('http');

var options = {
  appKey: 'App key',
  logBody: true,
  ironleapUrl: 'https://analytics.ironleap.io/api/collect',
};


var server = http.createServer(function (req, res) {
  ironleapnode(options)(req, res, function () {
    // Callback
  });

  req.on('end', function () {
    res.write(JSON.stringify({
      message: "hello world!",
      id: 2
    }));
    res.end();
  });
});

server.listen(8080);

```

## Configuration options

#### __`logBody`__
Type: `Boolean`
logBody is default to true, set to false to remove sending of request and response body.


#### __`identifyCompany`__

Type: `(Request, Response) => String`
identifyCompany is a function that takes express `req` and `res` as arguments
and returns a `companyId`. 

```javascript
options.identifyCompany = function (req, res) {
  // your code here, must return a string
  return req.headers['X-Organization-Id']
}
```

#### __`getMetadata`__

Type: `(Request, Response) => Object`
getMetadata is a function that takes a express `req` and `res` and returns an object that allows you
to add custom metadata that will be associated with the req. The metadata must be a simple javascript object that can be converted to JSON. For example, you may want to save a VM instance_id, a trace_id, or a tenant_id with the request.


```javascript
options.getMetadata = function (req, res) {
  // your code here:
  return {
    foo: 'custom data',
    bar: 'another custom data'
  };
}
```

#### __`skip`__

Type: `(Request, Response) => Boolean`
skip is a function that takes a express `req` and `res` arguments and returns true if the event should be skipped (i.e. not logged)
<br/>_The default is shown below and skips requests to the root path "/"._


```javascript
options.skip = function (req, res) {
  // your code here. must return a boolean.
  if (req.path === '/') {
    // Skip probes to home page.
    return true;
  }
  return false
}
```

#### __`requestMaskHeaders`__
List of request headers to mask out when sending to Iron Leap. Default is to not mask out any.

#### __`responseMaskHeaders`__
List of response headers to mask out when sending to Iron Leap. Default is to not mask out any.

#### __`maskContent`__

Type: `APIEvent => APIEvent`
maskContent is a function that takes and Iron Leap APIEvent as an argument before being sent the event.
With maskContent, you can make modifications to headers or body such as removing certain header or body fields.


```javascript
options.maskContent = function(event) {
  // remove any field that you don't want to be sent
  return event;
}
 ```

#### __`debug`__
Type: `Boolean`
Set to true to print debug logs if you're having integration issues.

#### __`maxBatchSize`__

Type: number
Default 25. This is the maximum batch size of events to send


#### __`maxSendInterval`__

Type: number in milliseconds
Default 2000. Max number of ms to wait before triggering the sending of the back.

#### __`requestMaxBodySize`__

Type: number
Default 100000. Maximum request body size in bytes to log when sending the data.

#### __`responseMaxBodySize`__

Type: number
Default 100000. Maximum response body size in bytes to log when sending the data.

