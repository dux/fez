// Swaps XMLHttpRequest (the transport behind Fez.req) for a recorder. Every
// send lands in `requests` and stays pending until respond() / reject(); abort()
// and an elapsed xhr.timeout fire the matching handler like the real thing.
// Call restore() in teardown.
//
//   request.url / method / headers (lower-cased names) / body / aborted
//   request.respond(status, text, headers?, url?)   server answered
//   request.reject()                                 network failure
//   request.progress(loaded, total)                  upload progress event
export function installMockXHR() {
  const requests = [];
  const original = globalThis.XMLHttpRequest;

  class FakeXHR {
    constructor() {
      this.upload = {};
      this.status = 0;
      this.statusText = '';
      this.responseText = '';
      this.responseURL = '';
      this.responseType = '';
      this.timeout = 0;
      this._headers = {};
      this._responseHeaders = '';
      this._done = false;
    }

    open(method, url) {
      this._method = method;
      this._url = url;
    }

    setRequestHeader(name, value) {
      this._headers[name.toLowerCase()] = value;
    }

    getAllResponseHeaders() {
      return this._responseHeaders;
    }

    get response() {
      return this.responseText;
    }

    _finish(handler) {
      if (this._done) {
        return false;
      }
      this._done = true;
      clearTimeout(this._timer);
      this[handler]?.();
      return true;
    }

    send(body) {
      const xhr = this;
      this._request = {
        url: this._url,
        method: this._method,
        headers: this._headers,
        body,
        xhr,
        respond(status = 200, text = '', headers = {}, url = '') {
          xhr.status = status;
          xhr.statusText = status === 200 ? 'OK' : '';
          xhr.responseText = text;
          xhr.responseURL = url;
          xhr._responseHeaders = Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n');
          xhr._finish('onload');
        },
        reject() {
          xhr._finish('onerror');
        },
        progress(loaded, total) {
          xhr.upload.onprogress?.({ loaded, total, lengthComputable: true });
        },
      };
      requests.push(this._request);
      if (this.timeout) {
        this._timer = setTimeout(() => this._finish('ontimeout'), this.timeout);
      }
    }

    abort() {
      if (this._request && !this._done) {
        this._request.aborted = true;
      }
      this._finish('onabort');
    }
  }

  globalThis.XMLHttpRequest = FakeXHR;

  return {
    requests,
    restore: () => {
      if (original === undefined) {
        delete globalThis.XMLHttpRequest;
      } else {
        globalThis.XMLHttpRequest = original;
      }
    },
  };
}
