import { STATS } from "./analytics"

// Quartz announces every page, the first one included, with a nav event; count.js counting on
// load as well would count the first page twice.
;(window as unknown as { goatcounter: object }).goatcounter = {
  no_onload: true,
  endpoint: `${STATS}/count`,
}
