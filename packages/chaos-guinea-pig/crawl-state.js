const superagent = require('superagent');

class CrawlState {
    constructor() {
        this.external_links =[]
    }

    async check_link(link) {
        if(this.external_links.includes(link.attribs.href)) return;
        console.log("checking link", link.attribs.href)
        const lres= await superagent.get(link.attribs.href)
        if(lres.status==200) {
            this.external_links.push(link.attribs.href)
        } else {
            throw new Error(`Got response ${lres.status} to link request ${link.attribs.href}`)
        }


    }
}

module.exports=CrawlState