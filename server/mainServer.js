const express = require('express');
const path = require('path');
const webpack = require('webpack');
const logger = require('../build/lib/logger');
const webpackConfig = require('../build/webpack.config');
const project = require('../project.config');
const compress = require('compression');
var https = require('https');
var fs = require('fs');
var http = require('http');
var getIP = require('ipware')().get_ip;

const mysite = ('./build/cert/wanchain.org.key'); //key
const mysiteCrt = ('./build/cert/3bb55a3526ededcc.crt'); //
const gd1 = ('./build/cert/gd_bundle-g2-g1.crt');

const app = express();
app.use(compress());

// app.use(function(req, res, next) {
//   var ipInfo = getIP(req);
//   console.log(ipInfo);
//   // { clientIp: '127.0.0.1', clientIpRoutable: false }
//   next();
// });

// ------------------------------------
// Apply Webpack HMR Middleware
// ------------------------------------

if (project.env === 'production') {
  const compiler = webpack(webpackConfig);

  logger.info('Enabling webpack development and HMR middleware');
  app.use(require('webpack-dev-middleware')(compiler, {
    publicPath  : webpackConfig.output.publicPath,
    contentBase : path.resolve(project.basePath, project.srcDir),
    hot         : true,
    quiet       : false,
    noInfo      : false,
    lazy        : false,
    stats       : 'normal',
  }));
  app.use(require('webpack-hot-middleware')(compiler, {
    path: '/__webpack_hmr'
  }));

  // Serve static assets from ~/public since Webpack is unaware of
  // these files. This middleware doesn't need to be enabled outside
  // of development since this directory will be copied into ~/dist
  // when the application is compiled.
  // app.use(express.static(path.resolve(project.basePath, 'public')));
  app.use(express.static(path.resolve(project.basePath, project.outDir)));

  // This rewrites all routes requests to the root /index.html file
  // (ignoring file requests). If you want to implement universal
  // rendering, you'll want to remove this middleware.
  app.use('*', function (req, res, next) {
    const filename = path.join(compiler.outputPath, 'index.html');
    compiler.outputFileSystem.readFile(filename, (err, result) => {
      if (err) {
        return next(err)
      }
      res.set('content-type', 'text/html');
      res.send(result);
      res.end()
    })
  })
} else {
  logger.warn(
    'Server is being run outside of live development mode, meaning it will ' +
    'only serve the compiled application bundle in ~/dist. Generally you ' +
    'do not need an application server for this and can instead use a web ' +
    'server such as nginx to serve your static files. See the "deployment" ' +
    'section in the README for more information on deployment strategies.'
  );

  // Serving ~/dist by default. Ideally these files should be served by
  // the web server and not the app server, but this helps to demo the
  // server in production.
  app.use(express.static(path.resolve(project.basePath, project.outDir)))
}

const httpapp = express();
const server = new http.Server(httpapp);
httpapp.use('*', function(req, res) {
  console.log("HTTP: " + req.url);
  return res.redirect("https://" + req.headers["host"] + req.url);
});
httpapp.listen(80);

module.exports = https.createServer({
  key: fs.readFileSync(mysite),
  cert: fs.readFileSync(mysiteCrt),
  ca: [fs.readFileSync(gd1)],
  requestCert: false,
  rejectUnauthorized: false
  //ca: [fs.readFileSync(gd1)]
}, app);
