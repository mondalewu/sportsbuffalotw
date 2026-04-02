import { runNpbStandingsScraper } from './services/npbStandingsScraper';
runNpbStandingsScraper().then(r => { console.log(r.message); process.exit(0); }).catch((e: Error) => { console.error(e.message); process.exit(1); });
