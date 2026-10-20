# Walkthrough: Toast DevEx Sample Kit

For the Staff SWE Developer Experience / SWE II Developer Experience interviews. Five bullets to present from, then follow-ups.

## 5 interview bullets

1. **It is a DevEx deliverable, not a demo.** I built what a Developer Experience team actually ships: a sample kit whose goal is time to first success. Two commands, under 5 minutes to a completed paid order, no database, no keys, no config. The quickstart is the product.
2. **One error shape, always.** Every failure returns `{ error: { code, message, hint }, requestId }`, and the `x-request-id` header echoes the body id. A developer can paste either into a support message and the integration team can find the log line.
3. **Errors teach the recovery path.** The declined card returns 402 with a hint naming the exact next step, the unknown card error names the two test cards, a double payment returns 409 because only pending orders are payable. I designed the hints from the question a developer would ask next.
4. **The examples cannot lie.** Every curl in the quickstart was run against the live server before shipping, and the 10 automated tests exercise the same paths, so the docs and the code cannot drift apart.
5. **Failure paths are first class.** Decline, double payment, bad card number, unknown menu item, bad restaurant id are all documented, tested, and reachable in under a minute each. Most sample kits only show the happy path; mine shows how the product behaves when things go wrong, which is where developer trust is actually built.

## Likely follow-ups

**Q: Is this Toast's real API?**
A: No, and I say so in the README's first line. It is a simulated API I defined, inspired by typical restaurant platform APIs. I do not claim it is Toast's API and I do not know Toast's internal API shape. The point of the kit is the DevEx craft, error design, quickstart, tested examples, not reverse engineering their API.

**Q: Why zero dependencies?**
A: Two reasons. Sample kits should run anywhere Node runs, and keeping it to node:http means there is no supply chain to audit and nothing to break when a registry hiccups. The tradeoff is hand-rolled JSON body parsing and routing, which is about 40 lines and fully covered by tests.

**Q: Why is data in memory instead of a database?**
A: Intentional. A database is setup friction between the developer and their first successful order. For a sample kit, time to first success wins over persistence. The store module is a clean seam, a real backing store would slot in behind the same types.

**Q: How would you add authentication?**
A: An API key check at the top of the request handler, before routing: missing key returns 401 in the same error shape with a hint pointing at a getting started page. Rate limiting would use the key as the bucket and return 429 with a `Retry-After` header. Both would follow the one-shape rule.

**Q: What is missing or simplified?**
A: Real card validation is a simulated branch on two test numbers, no real money moves. Tax is a flat rate, no tip handling, no order modifications after creation, no pagination on the menu, and concurrency is single process Node so there are no race conditions to worry about. Production hosting is Replit, local machines, and GitHub Actions CI; I have no AWS, GCP, Azure, or Oracle production experience, which I answer honestly.

**Q: Could this scale to real traffic?**
A: Not as built. It is in memory and single process. A real version would need a database, idempotency keys on order creation and payment so retries are safe, and webhook delivery for async payment settlement instead of a synchronous authorize. I would design those the same way I designed the error hints: from the developer's failure modes outward.
