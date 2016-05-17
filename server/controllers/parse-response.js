import cheerio from 'cheerio';
import _ from 'lodash';
import statusCodes from '../config/status-codes';


export default class ParseResponse {
  constructor(bodyTagName) {
    this.bodyTagName = bodyTagName;
  }

  parse(soapResponse) {
    let XMLHeader = /\<\?[\w\s\=\.\-\'\"]+\?\>/gi;
    let soapHeaderPrefixes = /(\<([\w\-]+\:[\w\-]+\s)([\w\=\-\:\"\'\\\/\.]+\s?)+?\>)/gi;

    // Remove the XML header tag
    soapResponse = soapResponse.replace(XMLHeader, '');

    // Get the element PREFIXES from the soap wrapper
    let soapInstance = soapResponse.match(soapHeaderPrefixes);
    let soapPrefixes = soapInstance[0].match(/((xmlns):[\w\-]+)+/gi);
    soapPrefixes = soapPrefixes.map((prefix) => {
      return prefix.split(':')[1].replace(/\s+/gi, '');
    });

    // Now clean the SOAP elements in the response
    soapPrefixes.forEach((prefix) => {
      let xmlPrefixes = new RegExp(prefix + ':', 'gmi');
      soapResponse = soapResponse.replace(xmlPrefixes, '');
    });

    // Remove xmlns from the soap wrapper
    soapResponse = soapResponse.replace(/(xmlns)\:/gmi, '');

    // lowercase and trim before returning it
    this.response = soapResponse.toLowerCase().trim();
    return this;
  }

  toJSON() {
    this.json = {};
    let $ = cheerio.load(this.response, { xmlMode: true });
    $(this.bodyTagName).children().each((i, el) => {
      if (el.children.length > 1) {
        console.log('Has more than one child.');
      }

      if (el.children.length === 1) {
        // console.log(el.name, el.children[0].data);
        this.json[el.name] = el.children[0].data.replace(/\s{2,}/gi, ' ').replace(/\n/gi, '').trim();
      }
    });

    // Unserialise the ENC_PARAMS value
    if ('enc_params' in this.json) {
      this.json.enc_params = JSON.parse(this.json.enc_params);
    }

    // Get the equivalent HTTP CODE to respond with
    this.json = _.assignIn(this.extractCode(), this.json);
    delete this.json.return_code;
    return this.json;
  }

  extractCode() {
    return _.find(statusCodes, (o) => o.returnCode == this.json.return_code);
  }
}
