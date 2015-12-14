var sync = require('synchronize');
var request = require('request');
var cheerio = require("cheerio");
var _ = require('underscore');


// The API that returns the in-email representation.
module.exports = function(req, res) {
  if (!req.query.url) {
    res.status(400).send('Error: URL parameter is required');
    return;
  }

  var url = req.query.url.trim();

  // Retrieve URL contents for scraping
  // Note that this fails on websites with scraping protections that deny
  // users who don't execute Javascript (Cloudflare does this). To bypass that, we should
  // eventually use a full browser environment (e.g. Selenium) for scraping.
  request(url, function (error, response, body) {
    if (error) {
      res.status(404).send("Error retrieving page");
      return;
    }

    var $ = cheerio.load(body);

    // WARNING: MASSIVE SECURITY VULNERABILITY.
    // We're taking unthrusted content from the intent and serving it in HTML.
    // This is a proof of concept, we should filter for XSS content.

    // For each attribute, look for the following meta tags in the order specified
    var title = retrieve_meta_tag($, ["og:title", "twitter:title"]);
    var description = retrieve_meta_tag($, ["og:description", "twitter:description", "description"]);
    var image = retrieve_meta_tag($, ["og:image", "twitter:image:src"]);

    if (description === undefined && image === undefined) {
      // We don't have enough information to assemble a nice HTML block
      res.status(404).send();
      return
    }

    // Assemble HTML. If this grows in any more complexity,
    // we should use a proper templating language.

    var html = '<div style="padding: 12px 8px; border: 1px solid #8d12a7; overflow: auto;">';

    if (image !== undefined) {
      html +=  '<img style="max-width:50%; float: left; padding-right: 20px;" src="' + image + '" width="100"/>';
    }

    html +=  '<h2 style="font-family: sans-serif; font-size: 16px; margin: 10px 0 10px;">' + title + '</h2>';

    if (description !== undefined) {
      html +=  '<p style="font-family: sans-serif; margin: 10px 0;">' + description + '</p>';
    }

    html += '</div>';

    res.json({
      body: html
    });
  })
};

// Given an array of meta tags to check, looks for them in the HTML.
// Returns the content of first meta tag found, or undefined if none were found.
function retrieve_meta_tag($, meta_properties) {
  for (var i = 0; i < meta_properties.length; i++) {
    var $tag = $('meta[property="' + meta_properties[i] + '"]')

    if (!$tag.length) {
      // both meta 'property' and 'name' are valid HTML
      $tag = $('meta[name="' + meta_properties[i] + '"]')
    }

    if ($tag.length) {
      return $tag.attr("content");  // we found something
    }
  }
}
