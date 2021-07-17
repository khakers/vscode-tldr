import { MarkdownString, commands, window } from "vscode";
import { platform } from "os";

export interface TldrFetcher {
  fetch(command: TldrPage): Thenable<string>;
}

export class TldrPage {
  platform: TldrPlatform;
  command: string;

  constructor(platform: TldrPlatform, command: string) {
    this.platform = platform;
    this.command = command;
  }

  toString(): string {
    return this.platform + "/" + this.command;
  }
}

export enum TldrPlatform {
  Common = "common",
  Linux = "linux",
  OSX = "osx",
  SunOS = "sunos",
  Windows = "windows",
}

const fetch = require("isomorphic-fetch");

class TldrIndex {
  // Array of all found TLDR pages for the available platforms
  pages: TldrPage[] = [];

  readonly baseUrl =
    "https://api.github.com/repos/tldr-pages/tldr/contents/pages/";
  readonly treeBaseUrl =
    "https://api.github.com/repos/tldr-pages/tldr/git/trees/";

  constructor() {
    this.initializeData();
  }

  //Runs fetchPageIndex for every platform
  async initializeData() {
    let map: Map<string, string> = new Map();
    fetch("https://api.github.com/repos/tldr-pages/tldr/contents/pages/").then(
      (response: any) => {
        if (response.status !== 200) {
          if (response.status === 403) {
            console.log("being rate limited");
            window.showErrorMessage(
              "VSCode-TLDR Redux has hit GitHub rate limits"
            );
          }
          console.warn(
            "Looks like there was a problem. Status Code: " + response.status
          );
          return;
        }

        console.log(
          "x-ratelimit-limit " + response.headers.get("x-ratelimit-limit")
        );
        console.log(
          "x-ratelimit-remaining " +
            response.headers.get("x-ratelimit-remaining")
        );
        console.log(
          "x-ratelimit-reset " + response.headers.get("x-ratelimit-reset")
        );
        console.log(
          "x-ratelimit-resource " + response.headers.get("x-ratelimit-resource")
        );
        console.log(
          "x-ratelimit-used " + response.headers.get("x-ratelimit-used")
        );

        response.json().then((data: any) => {
          Object.values(TldrPlatform).forEach(async (platform) => {
            console.log(
              "Fetch:",
              platform,
              data.filter((p: any) => p.name === platform)[0].sha
            );
            return await this.fetchPageIndexTree(
              platform,
              data.filter((p: any) => p.name === platform)[0].sha
            );
          });
        });
      }
    );
  }

  //Parses the github API response for the contents of the chosen pages platform
  //And then pushes them to the pages array
  //Response is limited to 1000 items
  fetchPageIndex(platformToFetch: TldrPlatform): Promise<void> {
    return fetch(this.baseUrl + platformToFetch)
      .then((response: any) => response.json())
      .then((data: any) => {
        let doc;
        let count = 0;
        for (doc of data) {
          ++count;
          let commandName = doc.name.split(".")[0];
          let page = new TldrPage(platformToFetch, commandName);
          this.pages.push(page);
        }
        console.log(platformToFetch + " count: " + count);
      });
  }

  //version of fetchPageIndexwhich can return more than 1000 results
  fetchPageIndexTree(
    platformToFetch: TldrPlatform,
    sha: string
  ): Promise<void> {
    return fetch(this.treeBaseUrl + sha)
      .then((response: any) => response.json())
      .then((data: any) => {
        let tree = data.tree;
        let doc;
        let count = 0;
        for (doc of tree) {
          ++count;
          let commandName = doc.path.split(".")[0];
          let page = new TldrPage(platformToFetch, commandName);
          this.pages.push(page);
        }
        console.log(platformToFetch + " count: " + count);
      });
  }

  //Checks the pages array to see if it contains the passed string and returns the page if it does
  isAvailable(command: string) {
    let results = this.pages.filter((p: TldrPage) => p.command === command);
    // console.log(results);
    console.log(
      "filtered result:",
      results.filter((p: TldrPage) => p.platform === TldrPlatform.Common)
        .length != 0
        ? results.filter((p: TldrPage) => p.platform === TldrPlatform.Common)[0]
        : results[0]
    );
    //Return the Common platform if multiple platforms are returned
    return results.filter((p: TldrPage) => p.platform === TldrPlatform.Common)
      .length != 0
      ? results.filter((p: TldrPage) => p.platform === TldrPlatform.Common)[0]
      : results[0];
  }
}

export class TldrRepository {
  fetcher: TldrFetcher;
  index: TldrIndex;

  constructor(fetcher: TldrFetcher) {
    this.fetcher = fetcher;
    this.index = new TldrIndex();
  }

  //First checks with isAvailable to see if it exists
  getMarkdown(command: string): Thenable<MarkdownString> {
    let page = this.index.isAvailable(command);
    // console.log(page.toString)
    console.log("isAvailable: " + page);
    if (page) {
      return this.fetcher
        .fetch(page)
        .then((text) => new MarkdownString(this.format(text)));
    }
    return Promise.reject(new MarkdownString("not available"));
  }

  format(contents: string): string {
    contents = contents.replace("\n> ", "\n");
    let headline = contents.indexOf("\n");
    return contents.substring(headline);
  }
}
