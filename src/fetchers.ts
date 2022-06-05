import { TldrFetcher, TldrPage } from "./TldrRepository";
import { Memento, window } from "vscode";
import { pathToFileURL } from "url";
import fetch from "node-fetch";

export class CachingFetcher implements TldrFetcher {
  static readonly cacheKeyPrefix = "tldrfetcher.cache.";
  delegate: TldrFetcher;
  memento: Memento;

  constructor(memento: Memento, delegate: TldrFetcher) {
    this.delegate = delegate;
    this.memento = memento;
  }

  fetch(command: TldrPage): Thenable<string> {
    const cacheKey = CachingFetcher.cacheKeyPrefix + command.command;
    let cachedPage = this.memento.get(cacheKey);
    console.log("Cached? " + cachedPage === undefined);
    if (cachedPage === undefined) {
      return this.delegate.fetch(command).then((page) => {
        this.memento.update(cacheKey, page);
        return page;
      });
    } else {
      console.debug("Cache hit");
    }
    return Promise.resolve(String(cachedPage));
  }
}

export class GithubFetcher implements TldrFetcher {
  readonly baseUrl =
    "https://raw.githubusercontent.com/tldr-pages/tldr/master/pages/";
  fetch(page: TldrPage): Thenable<string> {
    console.log(this.baseUrl + page.platform + "/" + page.command + ".md");
    let url = this.baseUrl + page.platform + "/" + page.command + ".md";
    let content = fetch(url)
      .then((response: any) => {
        if (response.status !== 200) {
          console.warn(
            "A problem occured fetching tldr page. Status code:" +
              response.status
          );
          window.showErrorMessage(
            "A problem occured fetching tldr page. Status code:" +
              response.status
          );
        }
        return response.text();
      })
      .then((text: any) => text);
    console.log(content);
    return content;
  }
}
