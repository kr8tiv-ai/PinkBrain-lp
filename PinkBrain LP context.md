PinkBrain LP is an app that takes fees from bags and auto compounds 2 different tokens into an LP from BagsApp fees. You can change the tokens at any time. The fees from those LPs can be set at any range meteora offers and you can change the tokens at any time but the tokens stay locked in LP forever. You can direct the fees up to 100 people.

It works on the same basis as the bags app auto distribute fees app works on bags

Except it should allow someone to select any two tokens, not just their own, and then create a locked lp on meteora and get the fees after bags receives its fees

The app takes the funds and buys the two tokens, creates a locked lp on metoera and automatically compounds it. Those fees go back to either the top 100 users or the owner of the token

This will be in the bags app app store

It must use the bags app api and work like their distributions work for fees apps in the app library

A user can use their own token or any other token they wish on the solana blockchain

It must match the bags app UI

Context for the hackathon

Q1 2026 Applications Open

# **The Bags Hackathon**

Introducing [The Bags Hackathon](https://x.com/BagsHackathon) with **$4,000,000 in funding** for developers building on [Bags.fm](https://bags.fm/launch). Build good tech, win cash, start companies. We're distributing $1M in grants to 100 teams that ship real products with real traction. The remaining $3M will go into [The Bags Fund](https://x.com/BagsFund) to support builders with capital, distribution, and more.

100 winners are selected based on real traction: onchain performance, app usage, and growth potential. Early traction and growth trajectory weigh heavily in our evaluation.

Applications are reviewed on a rolling basis. Apply now to be accepted into the first cohort.

## **Rules**

1

100 Winners

The top 100 projects each receive a grant between $10,000 and $100,000. Winners can apply to the Bags Fund for ongoing support with listings, capital, and more. Projects that ship and get traction will be rewarded.

2

Ranked by Real Traction

Winners are ranked holistically across two dimensions: onchain performance (market cap, volume, active traders, etc.) and app traction (MRR, DAU, Github Stars, etc.). New projects are also eligible and early signs of growth weigh heavily in our evaluation.

3

Verified Projects Only

All winning projects must be verified onchain. We verify the team, the contract, and the revenue. Ownership is confirmed and everything is publicly verifiable.

4

Must Use Bags

Your project must have a Bags token, use the Bags API, or release a fee sharing app. Deeper integrations rank higher.

5

Ship to Win

Ideas alone don't qualify. You must deploy a working product with real users and real transaction. Prototypes are accepted at application, but grants are distributed to shipped products. We reserve the right to evaluate projects qualitatively.

6

Rolling Applications

There is no single deadline. Applications are open throughout Q1, reviewed continuously, and grants are distributed as projects are accepted and verified.

## **How winners are ranked**

Projects are evaluated across two dimensions. For new projects, early signs of growth weigh heavily.

Product Traction

MRR, DAU, GitHub Stars, and more.

Onchain Performance

Market Cap, Volume, Active Traders, Revenue, \+ more.

## **Bonus prizes**

**![Verified badge][image1]**

Verified Hackathon Badge

Winners receive a verified badge marking them as a Bags Hackathon winner.

![Mac Mini][image2]

100 Mac Minis

Every hackathon winner receives a brand new Apple Mac Mini.

## **Categories**

Apply under any of the following categories. Projects can span multiple tracks.

Bags APIFee SharingAI AgentsClaude SkillsDeFiPaymentsPrivacySocial FinanceOther

## **Developer Resources**

[BagsDocs →](https://docs.bags.fm)[DFlowDocs →](https://docs.dflow.net)[PrivyDocs →](https://docs.privy.io)[HeliusDocs →](https://docs.helius.dev)[MeteoraDocs →](https://docs.meteora.ag)[SolanaDocs →](https://solana.com/docs)

## **Community**

Join the Bags Discord to connect with other builders, get support, and stay up to date on hackathon announcements. [Join Discord](https://discord.gg/bagsapp).

## **Refer a builder**

Know a great builder? Refer a builder to the hackathon and receive a share of the hackathon grant pool. [Get ref link](https://bags.fm/share).

## **About applying**

Fill out a short application. It takes about 5 minutes. You'll need your project name, a brief description, and a verified profile.

Projects that leverage the [Bags API](https://bags.fm/blueprint) are given priority. Grant sizes vary by scope and stage. We invest as soon as projects are accepted.

Questions? Reach out to apps@bags.fm or join the [Bags Discord](https://discord.gg/bagsapp).

Download on the App StoreGet it on Google Play  
[About](https://bags.fm/about)[Contact](https://bags.fm/contact)[Terms](https://bags.fm/terms)[Docs](https://docs.bags.fm)[Discord](https://discord.gg/bagsapp)[Support](https://support.bags.fm)

© 2026 Bags Holdings, Inc.

Bags is not an exchange and does not provide financial advice, endorsements, or investment recommendations. Trading involves risks and is for entertainment purposes only.

[https://bags.fm/hackathon](https://bags.fm/hackathon)

[https://docs.bags.fm/](https://docs.bags.fm/)

[https://solana.com/docs/rpc](https://solana.com/docs/rpc)

[https://solana.com/docs](https://solana.com/docs)

[https://solana.com/skills](https://solana.com/skills)  
[https://github.com/tenequm/skills/tree/main/skills/solana-development](https://github.com/tenequm/skills/tree/main/skills/solana-development)

[https://github.com/quiknode-labs/solana-anchor-claude-skill](https://github.com/quiknode-labs/solana-anchor-claude-skill)

[https://github.com/DFlowProtocol/dflow\_phantom-connect-skill](https://github.com/DFlowProtocol/dflow_phantom-connect-skill)

It should use helius rpc

[https://www.helius.dev/docs](https://www.helius.dev/docs)

Meteora skill

[https://github.com/sendaifun/skills/tree/main/skills/meteora](https://github.com/sendaifun/skills/tree/main/skills/meteora)

[https://docs.meteora.ag/](https://docs.meteora.ag/)

All revenue must pass through the proper set ups for [bags.fm](http://bags.fm) using their apis and keys making sure they get their fees and cut

It should have a nice UI just like the other ones on bags.app

This is a prd

**PinkBrain LP: Comprehensive Execution Specification and Technical Architecture**

## **Strategic Positioning and Ecosystem Alignment**

The decentralized finance landscape on the Solana blockchain has reached a critical inflection point, necessitating advanced automated protocols that maximize capital efficiency while simultaneously establishing unshakeable community trust. PinkBrain LP is engineered as a premier decentralized application tailored specifically for the Bags.fm ecosystem. The application functions as an automated, yield-optimizing liquidity engine designed to capture fees generated within the Bags application, programmatically convert these funds into any two user-designated tokens, and auto-compound the assets into a permanently locked Dynamic Liquidity Market Maker (DLMM) pool on the Meteora protocol. The subsequent trading fees generated by this un-ruggable liquidity pool are perpetually extracted and distributed either to the individual token owner or proportionally to the top 100 token holders, emulating and expanding upon the native Bags.fm dividend distribution architectures.

This comprehensive technical specification is formulated to serve as a foundational blueprint for the Get Shit Done (GSD) AI agent framework. The architectural directives within this document are strictly aligned with the overarching strategic mandates of the Q1 2026 Bags Hackathon. The hackathon provides a $4,000,000 developer fund, allocating $1,000,000 in immediate grants to 100 teams that successfully ship functional products demonstrating tangible on-chain traction, with the remaining $3,000,000 reserved within The Bags Fund for ongoing capital and distribution support. PinkBrain LP is meticulously designed to optimize the exact evaluation dimensions stipulated by the hackathon judges: on-chain performance metrics including market capitalization, trading volume, and active traders, alongside application traction metrics such as Monthly Recurring Revenue (MRR) and Daily Active Users (DAU). By operating entirely on-chain, utilizing the Bags API, integrating seamlessly into the Bags App Store, and releasing a highly sophisticated fee-sharing DeFi application, PinkBrain LP satisfies all verification and integration prerequisites to secure top-tier grant placement, a Verified Hackathon Badge, and the associated hardware rewards.

The core economic innovation of PinkBrain LP addresses a persistent vulnerability within the cryptocurrency sector: the risk of developer liquidity extraction, commonly referred to as a "rug pull." By mandating that the underlying liquidity tokens are locked forever using Meteora's specialized smart contracts, the protocol guarantees a perpetual, secure trading environment for the selected assets. Simultaneously, the protocol solves the opportunity cost traditionally associated with locked liquidity. While the base assets remain permanently immobilized, the dynamic swap fees generated by trading volume remain fully claimable and are automatically compounded or distributed by the PinkBrain LP background workers. This dual mechanism transforms static token communities into yield-generating assets, deeply aligning creator incentives with community prosperity and fulfilling the highest ideals of the decentralized creator economy.

## **Core System Architecture and Operational Workflow**

The operational lifecycle of PinkBrain LP operates as an infinite, asynchronous, and automated state machine. The architecture is explicitly designed to handle secure fund custody, execute multi-instruction atomic transactions on the Solana blockchain, and optimize computational efficiency through advanced routing and priority fee management. The system guarantees that all revenue pathways respect the overarching Bags.fm ecosystem rules, ensuring that the platform's native fee structures are strictly adhered to before subsequent compounding actions occur \[User Prompt\].

## **Continuous Fee Ingestion and Revenue Routing**

The primary catalyst for the PinkBrain LP workflow is the continuous accumulation of trading and platform fees originating from a user's activities within the Bags app. The application utilizes the native Bags API to monitor these balances. The system must authenticate using the x-api-key header, strictly managing request frequency to remain within the maximum allowance of 1,000 requests per hour per user across all integrated endpoints. The architecture relies on an off-chain automated heartbeat worker that periodically assesses the accumulated fee balances within the user's designated fee-share wallets.

A critical architectural mandate is the proper routing of all platform revenues. The application must guarantee that all funds pass through the appropriate Bags.fm setups, utilizing their APIs and keys to ensure the parent platform captures its requisite proportional cut of the transaction volume \[User Prompt\]. This is achieved by querying the Bags API configuration endpoints to retrieve the correct routing tables and utilizing the proper Program IDs and Address Lookup Tables (LUTs) required for compliant transaction serialization. Only after the platform fees are verified and settled does the PinkBrain LP logic take custody of the residual funds intended for the user's compounding strategy.

## **Arbitrary Token Swapping and Aggregation**

Unlike standard platform tools that restrict operations to a predefined ecosystem token or a creator's specific asset, PinkBrain LP provides absolute flexibility, allowing the user to select any two tokens that currently exist on the Solana blockchain \[User Prompt\]. This necessitates a highly robust integration with decentralized exchange aggregators capable of routing trades across deep liquidity pools to minimize price impact. Once the fee ingestion threshold is triggered, the off-chain worker constructs an exact-in swap transaction. The native SOL or base ecosystem tokens extracted from the Bags fee-share wallets are algorithmically split and swapped into the exact proportional ratios required by the two user-defined target tokens. This module must implement strict slippage tolerance parameters (typically capped at 0.5% to 1.0% depending on historical token volatility) to prevent sandwich attacks and maximal extractable value (MEV) exploitation during the asset acquisition phase.

## **Meteora DLMM Initialization and Permanent Liquidity Locking**

Following the successful acquisition of the two target tokens, the system interfaces directly with the Meteora DLMM infrastructure utilizing the @meteora-ag/dlmm SDK. The Dynamic Liquidity Market Maker protocol fundamentally differs from traditional constant-product automated market makers by organizing liquidity into discrete, zero-slippage price bins. The user retains complete administrative control over the fee parameters, capable of configuring the DLMM pool at any fee range offered by the Meteora protocol \[User Prompt\]. This involves configuring the specific bin step size—selecting smaller bin steps for highly correlated stable pairs to maximize trade volume capture, or larger bin steps for volatile meme assets to capture superior dynamic fee premiums.

If the specific token pair does not already possess a Meteora DLMM pool corresponding to the user's chosen fee tier and bin step, the PinkBrain LP application programmatically instantiates the pool using the SDK's initialization parameters. The system deposits the acquired tokens according to a predefined distribution strategy, commonly deploying a normal distribution curve centered around the current active market price to optimize immediate fee capture.

The defining characteristic of PinkBrain LP is the permanent, irreversible locking of this deposited liquidity \[User Prompt\]. The application integrates the Meteora Lock SDK (@meteora-ag/met-lock-sdk) to execute a permanent custody transfer or burn of the LP position withdrawal authority. This architectural guarantee ensures that while the user maintains the flexibility to alter which tokens are targeted for future fee auto-compounding cycles, any assets previously deposited into the pool can never be removed \[User Prompt\]. This mechanism establishes an absolute floor of liquidity for the selected tokens, inherently increasing the asset's market resilience and providing absolute cryptographic assurance to the token's community that the base liquidity is secure against developer manipulation.

## **The Auto-Compounding Engine and Dividend Distribution**

The Meteora DLMM protocol does not feature native, protocol-level auto-compounding; swap fees and dynamic protocol rewards accumulate within the specific active bins and must be explicitly claimed via a signed cryptographic transaction. The PinkBrain LP auto-compounding engine addresses this requirement through an autonomous, event-driven cycle. The system monitors the unclaimed fee balances associated with the locked LP positions. Upon reaching a computationally efficient threshold—where the expected yield mathematically exceeds the network transaction and priority fees—the system executes a claim transaction to extract the fees from the Meteora protocol.

Following the extraction, the application evaluates the user's selected distribution preference. The system offers a binary distribution pathway: routing the entirety of the yield back to the originating token owner, or executing a proportional distribution to the top 100 token holders \[User Prompt\]. If the user selects the community distribution model, the system queries the Solana blockchain to construct a real-time snapshot of token balances. The application sorts all holding accounts in descending order, strictly truncates the array to the top 100 non-protocol addresses, and calculates the exact fractional ownership weight of each participant relative to the top 100 aggregate total. The application then constructs a highly optimized, batched transaction payload to disperse the claimed fees directly into the wallets of these top 100 users, mirroring the highly successful dividend distribution mechanics natively utilized by the Bags application.

## **Bags.fm API Integration and Revenue Mechanics**

To satisfy the stringent hackathon requirements for deep integration and ecosystem alignment, PinkBrain LP is built as a native extension of the Bags platform, utilizing the official API for all internal state resolutions, user authentication, and revenue sharing configurations. The API architecture is designed to enforce security, ensure precise fee routing, and seamlessly integrate into the broader Bags app ecosystem.

## **API Authentication and Rate Limit Management**

All programmatic interactions with the Bags.fm backend require secure authentication via an API key injected into the x-api-key HTTP header. The application backend must securely manage these cryptographic credentials within encrypted environment variables. The Bags API enforces strict traffic limits, capping interactions at 1,000 requests per hour per user across all associated IP addresses. To maintain uninterrupted service, the PinkBrain LP execution engine implements a robust traffic control module. This module intercepts all HTTP responses, parsing the X-RateLimit-Remaining and X-RateLimit-Reset headers. As the remaining request quota approaches a critical minimum threshold, the application automatically throttles non-essential background polling tasks, queuing them in a local cache until the reset epoch is reached, thereby guaranteeing that critical transaction execution requests are never rejected due to rate limit violations.

## **Fee Sharing Configuration and Partner Verification**

The core functionality of PinkBrain LP relies on extracting the fees generated by a user's token launches and trading activities on the Bags platform. The application interacts heavily with the Fee Share and Partner endpoint groupings defined within the Bags API.

| API Endpoint Functionality | HTTP Method | Route Specification | System Purpose |
| :---- | :---- | :---- | :---- |
| **Retrieve Configuration** | GET | /api/v1/fee-share/config | Retrieves the overarching fee-sharing setup, identifying the specific wallet addresses and proportional splits governing the user's revenue streams. |
| **Bulk Wallet Query** | POST | /api/v1/fee-share/wallet/bulk | Efficiently queries the available balances across multiple fee-share wallets simultaneously, reducing total API request overhead. |
| **Claim Partner Fees** | POST | /api/v1/partner/claim | Requests the backend to generate a serialized Solana transaction that, when signed and submitted, extracts the designated fees into the PinkBrain operational smart contracts. |
| **Update Admin Config** | POST | /api/v1/fee-share/admin/update | Allows the user to programmatically adjust the routing of their fees, directing them into the PinkBrain auto-compounding engine. |

A paramount requirement of the hackathon rules is that all revenue must traverse the proper channels to ensure that Bags.fm secures its platform fees and designated cuts \[User Prompt\]. PinkBrain LP hardcodes these architectural safeguards into its transaction building process. When utilizing the POST /api/v1/partner/claim endpoint, the system ensures that the generated transaction payloads explicitly include the required Program IDs and protocol fee destinations defined by the Bags infrastructure before the residual funds are routed to the Meteora DLMM pool for compounding. This guarantees absolute compliance with the ecosystem's financial terms of service and prevents any potential circumvention of the parent platform's revenue model.

## **Meteora DLMM Integration and Liquidity Optimization**

The selection of Meteora's Dynamic Liquidity Market Maker (DLMM) protocol as the underlying compounding engine provides PinkBrain LP with unparalleled capital efficiency and fee-generation capabilities. The technical integration relies on the @meteora-ag/dlmm TypeScript SDK to manage pool state, execute complex mathematics, and interact with the Solana blockchain.

## **Dynamic Bin Mathematics and Range Configuration**

Traditional automated market makers spread liquidity across an infinite price curve from zero to infinity, resulting in severe capital inefficiency as the vast majority of deposited assets remain completely unutilized. Meteora's DLMM architecture resolves this by organizing liquidity into precise, discrete price increments known as bins. Trades occurring within a single active bin execute with absolute zero slippage, dramatically improving the trading experience and driving higher routing volume to the pool.

PinkBrain LP exposes the full spectrum of Meteora's configuration options to the end-user. When the user selects their two target tokens, they must also specify the DLMM parameters:

1. **Base Fee**: The minimum percentage charged for every swap executed against the liquidity position, configurable generally between 0.15% and 15% based on expected volatility.  
2. **Bin Step**: The difference in price between two consecutive bins. Smaller bin steps (e.g., 1 to 10 basis points) are utilized for highly stable or correlated asset pairs, while larger bin steps (e.g., 50 to 100 basis points) are deployed for highly volatile memecoins to widen the price range and capture elevated dynamic fees.

The total swap fee collected by the protocol is calculated dynamically: $f\_s \= f\_b \+ f\_v$, where $f\_b$ represents the static base fee and $f\_v$ represents a variable fee that algorithmically scales in direct proportion to real-time market volatility. This dynamic scaling ensures that during periods of extreme price discovery or market turbulence, the liquidity provider is compensated with significantly higher fees, offsetting potential impermanent loss.

## **SDK Implementation for Pool Creation and Liquidity Addition**

If a pool matching the user's exact token pair, bin step, and base fee parameters does not exist, PinkBrain LP utilizes the createCustomizablePermissionlessLbPair2 function within the SDK to deploy the initial pool infrastructure onto the blockchain.

When adding liquidity, either during the initial pool creation or during subsequent auto-compounding cycles, the application must dictate how the assets are distributed across the available price bins. The system utilizes the StrategyParameters object to define this distribution. PinkBrain LP programmatically defaults to specific strategies based on the asset profile:

* **Spot Strategy**: Distributes liquidity evenly across a wide range of bins, providing a stable, low-maintenance approach suitable for assets with unpredictable price action.  
* **Curve Strategy**: Concentrates the majority of the liquidity into the bins immediately adjacent to the current active market price, forming a bell-curve distribution. This maximizes capital efficiency and fee capture but requires active rebalancing if the price shifts dramatically.  
* **BidAsk Strategy**: Deploys a V-shaped distribution heavily weighted at the extreme ends of the selected price range, ideal for capturing fees during high-volatility, mean-reverting market conditions.

The application invokes the initializePositionAndAddLiquidityByStrategy method for new positions or addLiquidityByStrategy for existing positions, passing the calculated optimal token amounts derived from the autoFillXByStrategy and autoFillYByStrategy helper functions to ensure the transaction succeeds without ratio-matching errors.

## **Implementation of the Permanent Lock Mechanism**

The absolute core requirement of the PinkBrain LP protocol is that the tokens deposited into the Meteora DLMM pool stay locked in the LP forever \[User Prompt\]. This functionality is implemented using the official @meteora-ag/met-lock-sdk. Following the successful confirmation of the addLiquidity transaction, the system receives a cryptographic receipt representing the user's ownership of that specific liquidity position. The application instantly constructs a secondary transaction interacting with the Meteora Lock Program.

This transaction irreversibly transfers the withdrawal authority of the LP position to the Meteora protocol's immutable escrow contracts, permanently destroying the user's ability to extract the underlying base assets. Because this action is recorded transparently on the Solana blockchain, it provides absolute cryptographic proof to the token's community that the liquidity is permanently secured against rug pulls. Crucially, while the base assets are locked, the smart contract architecture explicitly preserves the user's right to invoke the claimSwapFee and claimLMReward functions, ensuring that the perpetual yield generated by the locked liquidity remains accessible for the PinkBrain LP auto-compounding and distribution engines.

## **Helius RPC Infrastructure and Real-Time Event Management**

The Solana blockchain's high-throughput architecture processes thousands of transactions per second, rendering traditional polling mechanisms highly inefficient and prone to extreme latency. To guarantee the instantaneous execution of the auto-compounding and distribution logic, PinkBrain LP integrates deeply with the Helius RPC infrastructure, specifically leveraging their Webhook systems and Priority Fee APIs.

## **Enhanced Webhook Architecture**

Instead of continuously querying the blockchain to determine if a user has accumulated sufficient fees or if a token swap has occurred, PinkBrain LP relies on Helius Enhanced Webhooks to establish a reactive, event-driven architecture. The system programmatically registers a webhook via the Helius API, directing the infrastructure to monitor the specific public keys associated with the user's Bags.fm fee-share vaults and the deployed Meteora DLMM pool addresses.

When a transaction occurs that alters the state of these monitored addresses, Helius immediately parses the raw blockchain data into a human-readable JSON payload and pushes it via an HTTP POST request directly to the PinkBrain LP backend. The system specifically filters for TOKEN\_MINT, SWAP, and TRANSFER transaction types. This push-based model reduces backend computational overhead to near zero during idle periods, ensuring that the application only consumes processing power when a relevant financial event actually takes place. Each webhook delivery consumes exactly 1 Helius credit, allowing for highly predictable and scalable infrastructure cost modeling.

## **Priority Fee Optimization and Congestion Mitigation**

During periods of significant market volatility or massive token launches, the Solana network can experience severe localized congestion, resulting in delayed or dropped transactions. If the PinkBrain LP auto-compounding or dividend distribution transactions fail to confirm, the system's economic flywheel stalls. To guarantee reliable execution, the application utilizes the Helius Priority Fee API.

Prior to submitting any transaction to the network, the PinkBrain backend constructs the complete transaction payload—including all necessary instructions for fee claiming, token swapping, liquidity addition, or dividend distribution. The backend serializes this complete transaction into a Base64-encoded string and transmits it to the Helius getPriorityFeeEstimate endpoint.

| Request Parameter | Data Type | Description |
| :---- | :---- | :---- |
| transaction | String | The fully constructed, Base64-encoded serialized transaction. |
| priorityLevel | String | Set to High or VeryHigh depending on the urgency of the auto-compound cycle. |
| recommended | Boolean | Requests the API to return the optimal historical estimation based on recent block congestion data. |

The Helius API analyzes the specific accounts referenced within the serialized transaction and returns the exact micro-lamport fee required to prioritize the transaction within the current network block. The backend extracts this value and injects a ComputeBudgetProgram.setComputeUnitPrice instruction into the transaction before finalizing the cryptographic signatures and broadcasting it to the network. This dynamic fee estimation ensures that PinkBrain LP consistently lands transactions even under extreme network load, satisfying the hackathon's requirement for robust on-chain performance.

## **The Dividend Distribution Algorithm**

A defining feature of the PinkBrain LP application is its capacity to disperse the accumulated yield to either the single token owner or to the broader community, specifically capping the community distribution to the top 100 token holders \[User Prompt\]. This functionality mirrors the established logic of the Bags.app auto-distribute fees app and the native @DividendsBot system. The mathematical execution of this distribution requires precise synchronization with the blockchain state to ensure equitable and accurate payouts.

## **Snapshot and Address Retrieval**

When the distribution trigger threshold (e.g., a minimum of 10 SOL in accumulated unclaimed earnings) is breached, the PinkBrain LP backend initiates the distribution protocol. The first step requires constructing a highly accurate, real-time snapshot of the token's distribution. The system queries the Helius Digital Asset Standard (DAS) API, passing the specific token mint address to retrieve a comprehensive array of all current token accounts and their associated balances.

## **Sorting, Truncation, and Proportional Mathematics**

Upon retrieving the complete list of token holders, the algorithm executes the following sequence:

1. **Exclusion Filtering**: The system cross-references the retrieved addresses against a known database of protocol addresses, liquidity pool vaults, and verifiable burn addresses. These accounts are systematically excluded from the calculation to prevent the yield from being distributed to unclaimable or non-human entities.  
2. **Sorting**: The remaining addresses are sorted in descending order based on their absolute token balance.  
3. **Truncation**: The sorted array is strictly truncated at the 100th index, isolating the "top 100 users" as mandated by the application requirements.  
4. **Aggregate Calculation**: The system sums the token balances of these 100 specific addresses to determine the Top\_100\_Aggregate\_Balance.  
5. **Proportional Weighting**: For each individual address within the top 100, the algorithm divides their specific balance by the Top\_100\_Aggregate\_Balance to generate a precise fractional ownership percentage.  
6. **Payout Determination**: The total yield claimed from the Meteora DLMM pool is multiplied by each address's fractional ownership percentage to calculate the exact micro-lamport payout designated for that specific user.

## **Optimized Transaction Batching**

Executing 100 individual transfer transactions would be highly inefficient, resulting in exorbitant network fees and increasing the probability of partial failure. Instead, PinkBrain LP bundles these transfers into highly optimized, batched transaction payloads. The system utilizes Solana Address Lookup Tables (LUTs) to compress the size of the required account addresses, allowing the maximum possible number of transfer instructions to be packed within the strict byte limits of a single Solana transaction block. This approach ensures that the entire dividend distribution occurs atomically and highly efficiently, depositing the yields directly into the recipients' wallets without requiring any manual claim actions on their part.

## **User Interface and App Store Integration**

To achieve seamless integration within the Bags App App Store, the PinkBrain LP frontend must strictly conform to the visual identity, interactive paradigms, and design constraints established by the Bags.fm platform and Apple's Human Interface Guidelines (HIG). The objective is to abstract the extreme complexity of DLMM bin mathematics, priority fee estimation, and Helius webhooks behind an intuitive, consumer-grade mobile interface that feels indistinguishable from a native Apple application.

## **Visual Design Language: Liquid Glass and Accessibility**

The user interface must adopt the "Liquid Glass" design aesthetic, which emphasizes translucency, spatial depth, and fluid responsiveness. The application background should utilize subtle, blurred layer materials to hint at the z-axis depth of the application, bringing the primary interaction panels into sharp focus. The color palette must harmonize with the modern, high-contrast dark modes prevalent in Web3 applications, utilizing highly saturated accent colors exclusively to highlight positive yield generation, active compounding states, and critical call-to-action buttons.

Typography must utilize crisp, sans-serif system fonts (such as SF Pro) tailored for high legibility on mobile devices. The application must strictly adhere to the HIG accessibility standards, ensuring that all text is rendered at a minimum of 11 points to guarantee readability without requiring the user to execute manual zoom gestures. Furthermore, all interactive elements—including token selection dropdowns, strategy toggles, and configuration sliders—must be engineered with hit targets measuring an absolute minimum of 44 by 44 points, ensuring frictionless touch navigation.

## **Core Application Views and Component Architecture**

The frontend architecture, likely constructed using React Native or a highly responsive Figma-to-code UI kit, is segmented into several distinct, task-oriented views to guide the user through the configuration process logically.

| Component View | Functionality and Interaction Design | Underlying Data Integration |
| :---- | :---- | :---- |
| **Global Dashboard** | Serves as the primary landing page post-authentication. Displays high-level aggregate metrics using large, bold typography. Visualizes the total fees successfully extracted from the Bags platform, the current Total Value Locked (TVL) within the locked Meteora DLMM pools, and the lifetime dividends distributed to the community. | Bags API (/fee-share/config), Meteora SDK (getFeeInfo). |
| **Token Pair Configurator** | An intuitive search interface permitting the user to input the contract addresses for any two tokens on the Solana blockchain \[User Prompt\]. Features real-time input validation, instantly fetching token metadata (logos, tickers) and displaying the current exchange rates sourced from the Jupiter aggregator API. | Solana RPC, Jupiter API, Helius DAS API. |
| **DLMM Strategy Matrix** | A highly visual configuration panel abstracting the Meteora bin mathematics. Utilizes smooth, responsive sliders to allow the user to select their desired base fee tier (0.15% to 15%) and bin step size. Includes segmented controls for quickly selecting predefined distribution templates (Spot, Curve, BidAsk) accompanied by simple, non-technical explanations of the expected volatility capture. | Meteora SDK (StrategyParameters). |
| **Distribution Command Center** | A clean, toggle-based interface allowing the user to dictate the destination of the auto-compounded yields. The primary toggle switches between "Token Owner" and "Top 100 Holders" \[User Prompt\]. If "Top 100 Holders" is selected, a scrollable list dynamically renders a real-time preview of the top wallets, displaying their truncated addresses and their calculated fractional payout percentages based on the current snapshot. | Helius DAS API (getTokenAccounts). |

## **GSD (Get Shit Done) Execution Roadmap and Specification**

This entire Product Requirements Document is specifically formatted to be ingested by the Get Shit Done (GSD) AI agent framework. GSD utilizes a highly structured, spec-driven development methodology, isolating complex system builds into discrete, atomic phases (Discuss, Plan, Execute, Verify) to eliminate context degradation during prolonged AI coding sessions.

To initiate the autonomous development of PinkBrain LP, the human operator will execute the command /gsd:plan-phase 1 \--prd pinkbrain-prd.md. The GSD agent will consume this document, map the required GitHub repositories and skill sets, and systematically generate the executable code across the following predefined phases.

## **Phase 1: Environment Initialization and Core Dependency Mapping**

**Objective**: Establish the foundational Node.js/TypeScript backend environment, configure the secure environment variable loaders, and integrate the mandatory external SDKs and reference skills.

**Agent Execution Directives**:

1. Initialize the project utilizing standard Solana dApp scaffolding conventions.  
2. Import and configure the required core libraries: @solana/web3.js for fundamental blockchain interaction, @meteora-ag/dlmm for pool state management, and @meteora-ag/met-lock-sdk for the permanent liquidity locking mechanism.  
3. Map and ingest the specific GitHub skill repositories mandated by the project requirements:  
   * https://github.com/tenequm/skills/tree/main/skills/solana-development for baseline Solana integration patterns \[User Prompt\].  
   * https://github.com/quiknode-labs/solana-anchor-claude-skill for AI-assisted Anchor framework smart contract interactions \[User Prompt\].  
   * https://github.com/sendaifun/skills/tree/main/skills/meteora for advanced, undocumented Meteora interaction scripts \[User Prompt\].  
   * https://github.com/DFlowProtocol/dflow\_phantom-connect-skill to establish the necessary wallet connection and transaction signing flows required for the frontend interface \[User Prompt\].

## **Phase 2: Bags.fm API Ingestion and Swapping Engine**

**Objective**: Construct the authentication pipelines, build the rate-limited API polling workers, and develop the token swapping logic.

**Agent Execution Directives**:

1. Implement a robust API client capable of authenticating via the x-api-key header, specifically parsing the X-RateLimit-Remaining headers to dynamically throttle requests.  
2. Build the services targeting the /api/v1/fee-share/config and /api/v1/partner/claim endpoints to monitor and extract the accumulated platform fees. Ensure all generated transactions strictly preserve the required Program IDs to guarantee Bags.fm captures its designated platform fees.  
3. Develop the integration module with the Jupiter routing API. This module must accept the incoming fees (in SOL or the base ecosystem token) and execute exact-in swaps to acquire the two specific tokens defined by the user interface, enforcing strict 0.5% maximum slippage parameters to neutralize potential MEV exploitation.

## **Phase 3: Meteora DLMM Deployment and Irreversible Custody Lock**

**Objective**: Programmatically instantiate the discrete liquidity bins and permanently revoke the withdrawal authority.

**Agent Execution Directives**:

1. Utilize the @meteora-ag/dlmm SDK to implement the createCustomizablePermissionlessLbPair2 function. This function must accept dynamic parameters from the frontend for the specific token mints, the selected base fee, and the calculated bin step.  
2. Develop the liquidity provision algorithm mapping the frontend UI selections to the SDK StrategyParameters (Spot, Curve, BidAsk). Implement the autoFillXByStrategy and autoFillYByStrategy helper math functions to calculate the exact token distribution ratios required by the active market bin.  
3. Construct the critical custody transfer service. Immediately upon successful deployment of the liquidity via initializePositionAndAddLiquidityByStrategy, invoke the @meteora-ag/met-lock-sdk to execute an immutable lock on the resulting LP position, ensuring the base assets remain permanently secured on the blockchain.

## **Phase 4: Auto-Compounding Loop and Dividend Algorithm**

**Objective**: Deploy the asynchronous background workers to claim swap fees, reinvest the capital, and execute the final dividend distribution.

**Agent Execution Directives**:

1. Integrate the Helius RPC infrastructure. Implement the getPriorityFeeEstimate JSON-RPC method to dynamically calculate the optimal micro-lamport bid required to survive network congestion, injecting this value into all outbound transaction payloads.  
2. Establish the Helius Enhanced Webhook listeners to monitor the deployed Meteora DLMM pool addresses for SWAP events, replacing inefficient time-based polling with instant, push-based HTTP notifications.  
3. Develop the fee claiming worker using the claimAllRewards SDK function.  
4. Construct the dividend distribution algorithm : Query the Helius DAS API for all token accounts holding the specific asset. Filter out system addresses. Sort the array by absolute balance. Truncate the array precisely at index 100\. Calculate the fractional ownership weighting. Bundle the resulting micro-lamport transfers into a highly optimized, batched transaction payload utilizing Address Lookup Tables (LUTs) to satisfy transaction size constraints.

## **Phase 5: App Store User Interface Construction**

**Objective**: Synthesize the frontend views adhering to the Apple HIG and the Bags.fm visual identity.

**Agent Execution Directives**:

1. Scaffold the frontend utilizing a modern framework (React Native or React web depending on the specific App Store container requirements).  
2. Implement the "Liquid Glass" global stylesheet, ensuring all backgrounds utilize subtle translucency, dark-mode compliant high-contrast text, and exact 44x44 point hit targets for all interactive buttons and sliders.  
3. Construct the specific component views outlined in the UI specification: The Global Dashboard, Token Pair Configurator, DLMM Strategy Matrix, and the Distribution Command Center, wiring all interactive states directly to the established backend controllers.

# **PinkBrain LP — Consolidated PRD v2**

**Status:** GSD-Ready  
 **Date:** 2026-03-26  
 **Target:** Bags Hackathon Q1 2026 ($1M grants / 100 teams)  
 **Scope:** General-purpose fee-compounding LP app for any Bags.fm user

---

## **1\. Executive Summary**

PinkBrain LP is a Bags App Store application that automates the conversion of Bags.fm fee income into permanently locked Meteora DAMM v2 liquidity positions. The core loop: **claim fees → swap into two user-selected tokens → add liquidity → permanently lock → claim LP fees → distribute or re-compound.**

The app serves any token creator or partner on Bags — not a single project. Users configure strategies specifying their fee source, target token pair, DAMM v2 pool parameters, lock preference, and distribution rules (owner-only or top-100 holders). The system handles execution autonomously.

### **Critical Technical Decision: DAMM v2, Not DLMM**

Meteora's own documentation explicitly states: *"DLMM pools don't provide LP tokens upon adding liquidity, so once the pool is created, liquidity deposited cannot be locked permanently (unlike dynamic AMM pools)."*

DAMM v2 (program ID: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`) is the only viable choice because it supports:

* **Permanent position locking** with continued fee claims (`permanentLockPosition` \+ `claimPositionFee`)  
* **Position NFTs** representing LP ownership  
* **Concentrated liquidity** via min/max price range (constant-product within that range)  
* **Dynamic fees** and fee scheduler support  
* **Single-sided liquidity** for launch flexibility

SDK: `@meteora-ag/cp-amm-sdk` (TypeScript)  
 Repo: `github.com/MeteoraAg/damm-v2-sdk`

**Any reference to DLMM, `@meteora-ag/dlmm`, bin steps, bin strategies (Spot/Curve/BidAsk), or `@meteora-ag/met-lock-sdk` in prior documentation is incorrect for this product and must not be implemented.**

---

## **2\. Problem Statement**

Creators and communities on Bags.fm earn ongoing trading fees (1% of volume for creators, 25% for partners) but lack automated tooling to convert that income into permanent, trust-building liquidity. Manual compounding is tedious and inconsistent. Locking liquidity signals commitment but traditionally means forfeiting yield. DAMM v2 solves this: locked positions still earn fees.

PinkBrain LP bridges the gap — set-and-forget fee-to-locked-LP conversion with transparent distribution.

---

## **3\. Hackathon Context and Constraints**

The Bags Hackathon launched March 10, 2026\. $1M is allocated across 100 teams that ship functional products with on-chain traction. Evaluation dimensions: market cap, trading volume, active traders, MRR, and DAU. A final showcase with demos follows submissions.

**Ecosystem partners providing resources and judges:** Solana, Helius, Meteora, Privy, DFlow, Birdeye.

**Implication for scope:** Ship a working compounding engine with clean UI first. Polish, advanced analytics, and edge cases come after traction is proven.

---

## **4\. Resolved Design Decisions**

### **4.1 Swap Routing: Bags API Only (Not Jupiter Directly)**

All swaps **must** route through Bags trade endpoints to ensure the platform captures its fee cut. This is both a hackathon compliance requirement and a product integrity decision.

* Quote: `GET /api/v1/trade/quote`  
* Swap tx: `POST /api/v1/trade/swap`

Jupiter may be the underlying aggregator within Bags' infrastructure, but PinkBrain LP never calls Jupiter directly. All trade volume flows through Bags, which the hackathon judges can verify on-chain.

### **4.2 Custody Model: Bags Agent Wallet**

For hackathon scope, the app operates using the **Bags Agent authentication flow** (challenge posted to Moltbook, 15-minute session). This avoids private key export entirely. The app authenticates as the user's agent, executes transactions within Bags' wallet infrastructure, and signs via the session.

**Post-hackathon consideration:** If the agent session's 15-minute TTL is too short for scheduled compounding, evaluate either (a) session refresh automation, or (b) a dedicated signing key stored in a managed secret store with minimal permissions. Private key export via Bags' wallet export endpoint is an absolute last resort and requires HSM/KMS-grade storage.

### **4.3 "Top 100 Users" Definition**

Per-strategy configurable. When a user selects "Top 100 Holders" distribution:

1. Query all token accounts for the strategy's target token via Helius DAS API (`getTokenAccounts`)  
2. Exclude known protocol addresses, LP vaults, burn addresses, and the strategy owner's own wallet (configurable)  
3. Sort remaining by balance descending  
4. Truncate at index 100  
5. Calculate proportional weight: `holder_balance / sum(top_100_balances)`  
6. Distribute claimed LP fees proportionally

The exclusion list is maintained per-strategy and editable by the strategy owner.

### **4.4 Existing Pool Handling**

When a user configures a strategy with a token pair:

1. **Check if a DAMM v2 pool exists** for that pair with compatible parameters (fee tier, price range)  
2. **If yes:** Create a new position in the existing pool, add liquidity, and lock  
3. **If no compatible pool exists:** Create a new DAMM v2 pool using `createCustomPool`, seed initial liquidity, and lock the position  
4. **If a pool exists but with incompatible parameters:** Present the user with the option to join the existing pool's parameters or create a new pool

This prevents pool fragmentation while respecting user preferences.

---

## **5\. Architecture**

### **5.1 System Components**

┌─────────────────────────────────────────────────┐  
│                 Bags App Store UI                │  
│  (Strategy config, dashboard, manual controls)  │  
└──────────────────────┬──────────────────────────┘  
                       │ REST API  
┌──────────────────────▼──────────────────────────┐  
│              Backend Service Layer               │  
│                                                  │  
│  ┌──────────────┐  ┌──────────────────────────┐ │  
│  │  Strategy     │  │  Compounding Orchestrator │ │  
│  │  Service      │  │  (scheduler \+ state       │ │  
│  │  (CRUD,       │  │   machine \+ retries)      │ │  
│  │   validation) │  │                           │ │  
│  └──────────────┘  └──────────┬───────────────┘ │  
│                               │                  │  
│  ┌────────────────────────────▼───────────────┐ │  
│  │         Integration Clients                 │ │  
│  │                                             │ │  
│  │  Bags Client        Meteora Client          │ │  
│  │  \- fee config       \- pool lookup/create    │ │  
│  │  \- claim txs        \- add liquidity         │ │  
│  │  \- trade quote      \- permanent lock        │ │  
│  │  \- swap tx          \- claim position fee    │ │  
│  │  \- agent auth       \- fetch pool state      │ │  
│  │                                             │ │  
│  │  Helius Client      Distribution Engine     │ │  
│  │  \- webhooks         \- holder snapshot       │ │  
│  │  \- priority fees    \- exclusion filtering   │ │  
│  │  \- DAS API          \- batched transfers     │ │  
│  │  \- tx submission    \- LUT compression       │ │  
│  └─────────────────────────────────────────────┘ │  
│                                                  │  
│  ┌─────────────────────────────────────────────┐ │  
│  │  Data Layer                                  │ │  
│  │  \- Strategy configs (PostgreSQL or SQLite)   │ │  
│  │  \- Immutable audit log (append-only)         │ │  
│  │  \- Metrics store                             │ │  
│  └─────────────────────────────────────────────┘ │  
└──────────────────────────────────────────────────┘

### **5.2 Compounding State Machine**

Each compounding run follows a strict state machine with idempotent transitions:

PENDING → CLAIMING → SWAPPING → ADDING\_LIQUIDITY → LOCKING → DISTRIBUTING → COMPLETE  
                                                                    │  
            any state can transition to → FAILED (with error code)  │  
            FAILED → PENDING (manual retry after reconciliation)    │

**Idempotency rules:**

* Each run has a unique `runId`  
* Each state transition records the tx signature before advancing  
* If a run is retried from FAILED, the orchestrator checks on-chain state before re-executing:  
  * If claim succeeded (tokens in wallet), skip to SWAPPING  
  * If swap succeeded (target tokens in wallet), skip to ADDING\_LIQUIDITY  
  * If liquidity added (position NFT exists, unlocked), skip to LOCKING  
  * If locked (position permanently locked), skip to DISTRIBUTING

---

## **6\. External Dependencies and APIs**

### **6.1 Bags API**

| Purpose | Method | Endpoint | Notes |
| ----- | ----- | ----- | ----- |
| Base URL | — | `https://public-api-v2.bags.fm/api/v1/` | Auth: `x-api-key` header |
| Fee share config | GET | `/fee-share/config` | Retrieves routing table |
| Bulk wallet balances | POST | `/fee-share/wallet/bulk` | Batch balance check |
| Claim partner fees | POST | `/partner/claim` | Returns serialized Solana tx |
| Claim token position fees | POST | `/token-launch/claim-txs/v2` | Claimable positions |
| Trade quote | GET | `/trade/quote` | Quote for swap |
| Create swap tx | POST | `/trade/swap` | Returns serialized swap tx |
| Fee share admin update | POST | `/fee-share/admin/update` | Redirect fees to compounding wallet |
| Rate limit | — | — | 1,000 req/hr per user \+ IP |

Rate limit headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

Additional resources:

* Bags SDK: `github.com/bagsfm/bags-sdk` (TypeScript)  
* Bags IDL: `github.com/bagsfm/bags-idl`  
* Program IDs: documented at `docs.bags.fm/principles/program-ids`  
* Address Lookup Tables: documented at `docs.bags.fm/principles/lookup-tables`

### **6.2 Meteora DAMM v2**

| Purpose | SDK Function | Notes |
| ----- | ----- | ----- |
| Initialize SDK | `new CpAmm(connection)` | From `@meteora-ag/cp-amm-sdk` |
| Find existing pools | `getAllPools()` / `fetchPoolState()` | Check for existing pair |
| Create pool | `createPool()` / `createCustomPool()` | `isLockLiquidity` flag available at creation |
| Create position | `createPosition()` | Returns position NFT |
| Add liquidity | `addLiquidity()` | To existing position |
| Permanent lock | `permanentLockPosition()` | **Irreversible.** Owner can still claim fees |
| Claim fees | `claimPositionFee()` / `claimPositionFee2()` | Works on locked positions |
| Claim rewards | `claimReward()` | LM rewards if applicable |
| Get position state | `fetchPositionState()` | Returns `permanentLockedLiquidity`, `unlockedLiquidity` |
| Get user positions | `getUserPositionByPool()` / `getPositionsByUser()` | List all positions |

Program ID (mainnet \+ devnet): `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`

**DAMM v2 pool parameters the user configures:**

* Token A mint, Token B mint  
* Base fee (percentage per swap)  
* Initial sqrt price (derived from current market price)  
* Price range (min/max for concentrated liquidity — constant-product within range)  
* Fee scheduler mode (linear or exponential, optional)  
* Dynamic fee toggle (volatility-adjusted, optional)

**What DAMM v2 does NOT have (unlike DLMM):**

* No discrete bins  
* No Spot/Curve/BidAsk strategy types  
* No zero-slippage within bins  
* No `@meteora-ag/dlmm` SDK functions

### **6.3 Helius RPC**

| Purpose | Method | Notes |
| ----- | ----- | ----- |
| Transaction submission | `sendTransaction` | Via Helius RPC endpoint |
| Priority fee estimation | `getPriorityFeeEstimate` | Pass serialized tx, get micro-lamport fee |
| Enhanced webhooks | Webhook API | Push-based monitoring of fee vaults and pool addresses |
| DAS API — token holders | `getTokenAccounts` | For top-100 holder snapshots |
| Transaction confirmation | `getTransaction` | Verify on-chain state |

Priority fee flow: construct tx → serialize to Base64 → call `getPriorityFeeEstimate` with `priorityLevel: "High"` → inject `ComputeBudgetProgram.setComputeUnitPrice` → sign and send.

### **6.4 Solana Core**

* `@solana/web3.js` for connection, keypair, transaction building  
* Commitment levels: use `confirmed` for reads, `finalized` for critical state checks post-lock  
* Address Lookup Tables (LUTs) for batched distribution transactions

---

## **7\. Product Requirements**

### **7.1 Strategy Configuration**

A strategy represents one compounding loop. Users configure:

| Field | Type | Constraints |
| ----- | ----- | ----- |
| Source fee stream | Enum | `CLAIMABLE_POSITIONS`, `PARTNER_FEES` |
| Target token A | Pubkey (base58) | Any SPL token on Solana |
| Target token B | Pubkey (base58) | Any SPL token on Solana |
| Swap slippage | BPS (uint16) | Default 50 (0.5%), max 300 (3%) |
| Max price impact | BPS (uint16) | Default 100 (1%), max 500 (5%) |
| DAMM v2 pool | Pubkey or "auto" | Join existing or create new |
| Price range | { min, max } | For concentrated liquidity; full range if omitted |
| Base fee tier | Percentage | Per Meteora config options |
| Lock mode | Enum | `PERMANENT` (only option for v1) |
| Distribution | Enum | `OWNER_ONLY` or `TOP_100_HOLDERS` |
| Exclusion list | Pubkey\[\] | Addresses excluded from top-100 calculation |
| Schedule | Cron or interval | Minimum: every 1 hour. Default: every 6 hours |
| Min compound threshold | SOL amount | Skip run if claimable \< threshold (avoids tx fees \> yield) |
| Status | Enum | `ACTIVE`, `PAUSED`, `ERROR` |

**Validation rules:**

* Token A ≠ Token B  
* Both mints must exist on-chain (verify via RPC)  
* If distribution \= `TOP_100_HOLDERS`, the target token for snapshot must be specified (could be token A, token B, or a third token — the user's community token)  
* Schedule interval must be ≥ 1 hour (rate limit protection)

### **7.2 Compounding Engine**

For each scheduled run:

1. **Discover** claimable fees for the strategy's source via Bags API  
2. **Check threshold** — skip if claimable amount \< `min_compound_threshold`  
3. **Claim** — generate claim tx via Bags API, add priority fee, sign, submit, confirm  
4. **Swap** — split claimed amount proportionally for the target pair, generate quote via Bags `/trade/quote`, build swap tx via `/trade/swap`, add priority fee, sign, submit, confirm  
5. **Add liquidity** — calculate amounts via DAMM v2 SDK (`getLiquidityDelta`, `getDepositQuote`), build add-liquidity tx, sign, submit, confirm. If no position exists, create one first.  
6. **Lock** — call `permanentLockPosition()` on the new or updated position. Confirm on-chain that `permanentLockedLiquidity > 0`.  
7. **Distribute** (if applicable) — claim LP fees from locked position via `claimPositionFee()`, then either:  
   * `OWNER_ONLY`: transfer to owner wallet  
   * `TOP_100_HOLDERS`: snapshot → calculate → batch transfer using LUTs  
8. **Record** — write immutable audit record with all tx signatures, amounts, slippage, timing

### **7.3 Fee Routing Compliance**

**All claimed fees must pass through Bags' fee infrastructure before PinkBrain LP touches them.** This means:

* Use Bags' `/partner/claim` or `/token-launch/claim-txs/v2` endpoints which generate transactions that include the correct Program IDs and protocol fee destinations  
* Never construct raw claim transactions that bypass Bags' fee routing  
* The Bags platform takes its cut within the claim transaction itself — PinkBrain LP operates on the residual

### **7.4 Distribution Engine (Top 100\)**

When distribution mode is `TOP_100_HOLDERS`:

1. Call Helius DAS API `getTokenAccounts` for the distribution token mint  
2. Filter out:  
   * Known LP pool vaults (Meteora, Raydium, Orca)  
   * Burn addresses (`1nc1nerator11111111111111111111111111111111`)  
   * Strategy-specific exclusion list  
   * Zero-balance accounts  
3. Sort by balance descending, truncate at 100  
4. Calculate: `payout_i = total_yield × (balance_i / sum_top_100_balances)`  
5. Build batched transfer instructions using Address Lookup Tables  
6. Add priority fee, sign, submit, confirm  
7. If total exceeds single-tx byte limit, split into multiple transactions and execute sequentially

### **7.5 User Interface**

The UI lives inside the Bags App Store container. Design must match Bags platform conventions (exact component library and constraints TBD — coordinate with `apps@bags.fm`).

**Core views:**

1. **Strategy List** — all strategies with status indicator, last run time, lifetime compounded value, next scheduled run  
2. **Create Strategy** — token pair selector with real-time validation (fetch metadata, logos, exchange rate), pool parameter configuration, distribution toggle, schedule picker  
3. **Strategy Detail** — token pair, pool address (linked to explorer), lock status, run history with expandable audit logs per run, distribution history  
4. **Manual Controls** — "Run Now" with confirmation dialog, Pause/Resume toggle  
5. **Settings** — exclusion list management, slippage/impact defaults, notification preferences

**UI scope cuts for hackathon v1:**

* No "Liquid Glass" aesthetic — use Bags' default component patterns  
* No Apple HIG compliance (this is a web app, not iOS native)  
* No advanced analytics or charts — simple tables and status indicators  
* No real-time animations — polling every 30s for status updates is fine

---

## **8\. Data Models**

### **Strategy**

interface Strategy {  
  strategyId: string;          // UUID  
  ownerWallet: string;         // base58 pubkey  
  source: 'CLAIMABLE\_POSITIONS' | 'PARTNER\_FEES';  
  targetTokenA: string;        // mint pubkey  
  targetTokenB: string;        // mint pubkey  
  distributionToken: string;   // mint for top-100 snapshot (may differ from A/B)  
  swapConfig: {  
    slippageBps: number;       // default 50  
    maxPriceImpactBps: number; // default 100  
  };  
  meteoraConfig: {  
    poolAddress: string | null;  // null \= auto-create  
    baseFee: number;             // percentage  
    priceRange: { min: number; max: number } | null; // null \= full range  
    lockMode: 'PERMANENT';  
  };  
  distribution: 'OWNER\_ONLY' | 'TOP\_100\_HOLDERS';  
  exclusionList: string\[\];     // pubkeys to exclude from top-100  
  schedule: string;            // cron expression or interval string  
  minCompoundThreshold: number; // in SOL (lamports internally)  
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';  
  lastRunId: string | null;  
  createdAt: string;           // ISO 8601  
  updatedAt: string;  
}

### **CompoundingRun**

interface CompoundingRun {  
  runId: string;               // UUID  
  strategyId: string;  
  state: 'PENDING' | 'CLAIMING' | 'SWAPPING' | 'ADDING\_LIQUIDITY'   
       | 'LOCKING' | 'DISTRIBUTING' | 'COMPLETE' | 'FAILED';  
  startedAt: string;  
  finishedAt: string | null;  
  claim: {  
    claimableAmount: number;   // lamports  
    txSignature: string | null;  
    confirmedAt: string | null;  
  } | null;  
  swap: {  
    quoteSnapshot: object;     // raw quote response for audit  
    tokenAReceived: number;  
    tokenBReceived: number;  
    actualSlippageBps: number;  
    txSignatures: string\[\];    // may be multiple (split swaps)  
  } | null;  
  liquidityAdd: {  
    positionNft: string;       // pubkey  
    liquidityDelta: string;    // BN as string  
    txSignature: string;  
  } | null;  
  lock: {  
    txSignature: string;  
    permanentLockedLiquidity: string; // BN as string, confirmed on-chain  
  } | null;  
  distribution: {  
    totalYieldClaimed: number;  
    recipientCount: number;  
    txSignatures: string\[\];  
  } | null;  
  error: {  
    code: string;  
    detail: string;  
    failedState: string;  
  } | null;  
}

---

## **9\. Internal API**

All endpoints versioned at `/v1/`. Auth via Bags session or JWT (TBD based on App Store container auth mechanism).

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/v1/strategies` | Create strategy |
| GET | `/v1/strategies` | List user's strategies |
| GET | `/v1/strategies/:id` | Strategy detail |
| PATCH | `/v1/strategies/:id` | Update strategy config |
| POST | `/v1/strategies/:id/pause` | Pause strategy |
| POST | `/v1/strategies/:id/resume` | Resume strategy |
| POST | `/v1/strategies/:id/run` | Trigger manual run |
| GET | `/v1/strategies/:id/runs` | List runs for strategy |
| GET | `/v1/runs/:runId` | Run detail with full audit |
| GET | `/v1/pools/search?tokenA=X&tokenB=Y` | Find existing DAMM v2 pools for pair |

---

## **10\. Security Requirements**

1. **No private key export** for hackathon scope — use Bags Agent auth exclusively  
2. **No private keys in logs** — structured logging with automatic redaction of any base58 string matching key patterns  
3. **Rate limit compliance** — implement token bucket with 1,000/hr cap, queue non-critical requests, reserve capacity for transaction-critical calls  
4. **Transaction integrity** — all transactions include recent blockhash (not nonce for v1), priority fees via Helius estimation, and are submitted with `skipPreflight: false`  
5. **Slippage protection** — enforce `maxPriceImpactBps` cap on every swap; abort run if quote exceeds threshold  
6. **Secrets management** — API keys in environment variables for hackathon; managed secret store (Vault, AWS Secrets Manager) for production  
7. **Audit trail** — every run produces an immutable record; no record is ever deleted or modified

---

## **11\. Non-Functional Requirements**

| Requirement | Target |
| ----- | ----- |
| Compounding run success rate | \> 95% |
| Mean run duration (claim → lock) | \< 60 seconds |
| Failed run detection (MTTD) | \< 5 minutes |
| Recovery from RPC failure | Automatic retry with exponential backoff, max 3 attempts |
| Rate limit utilization | \< 80% of 1,000/hr during normal operation |
| Concurrent strategies per user | Up to 10 |
| Max strategies system-wide (hackathon) | 1,000 |

---

## **12\. Risks and Mitigations**

| Risk | Severity | Mitigation |
| ----- | ----- | ----- |
| DAMM v2 pool doesn't exist for exotic pair | Medium | Auto-create with sensible defaults; warn user about initial liquidity requirement |
| Slippage/MEV on swaps | High | Conservative defaults (50bps), max impact cap, abort on exceed |
| Bags Agent session expires mid-run | High | Refresh session before each run; if expired mid-run, pause at current state and retry on next session |
| Rate limit exhaustion | Medium | Schedule jitter (±30s randomization), request batching, priority queue for tx-critical calls |
| Position lock is irreversible | Critical | Double confirmation UI, explicit warning, 10-second delay before lock tx submission |
| Holder snapshot stale by execution time | Low | Accept — snapshot taken at distribution time is authoritative; document this for users |
| Network congestion drops transactions | Medium | Helius priority fees, retry with escalating priority level |
| Bags API changes or adds new fee structures | Medium | Version-pin API calls, monitor changelog, abstract Bags client behind interface |

---

## **13\. Implementation Roadmap**

**Start date:** 2026-03-28 (Friday)  
 **Target:** Functional demo with on-chain traction for hackathon submission

### **Phase 1: Foundation (Days 1–3)**

* \[ \] Initialize TypeScript project with `@solana/web3.js`, `@meteora-ag/cp-amm-sdk`  
* \[ \] Implement Bags API client (auth, rate limiting, claim, trade endpoints)  
* \[ \] Implement Meteora DAMM v2 client (pool lookup, create position, add liquidity, lock, claim fees)  
* \[ \] Implement Helius client (priority fees, tx submission, DAS API for holders)  
* \[ \] **Proof of concept:** Execute one full compounding cycle manually on devnet/mainnet with a test wallet

### **Phase 2: Core Engine (Days 4–7)**

* \[ \] Strategy data model and storage (SQLite for hackathon; PostgreSQL for production)  
* \[ \] Compounding orchestrator with state machine and idempotent retries  
* \[ \] Scheduler (cron-based, with jitter)  
* \[ \] Distribution engine (top-100 snapshot, proportional calc, batched transfers)  
* \[ \] Audit log writer (immutable append-only)  
* \[ \] **Milestone:** Automated compounding running on a real strategy with locked position and fee distribution

### **Phase 3: UI and Integration (Days 8–11)**

* \[ \] Bags App Store embedded frontend (React or framework per Bags container requirements)  
* \[ \] Strategy creation flow with token search and validation  
* \[ \] Strategy list and detail views  
* \[ \] Manual run trigger and pause/resume controls  
* \[ \] Run history with audit log display  
* \[ \] **Milestone:** End-to-end user flow from strategy creation to verified locked LP position

### **Phase 4: Hardening (Days 12–14)**

* \[ \] Error handling and edge cases (empty claims, failed swaps, partial runs)  
* \[ \] Observability: structured logging, basic metrics dashboard  
* \[ \] Rate limit stress testing  
* \[ \] Security review: no key leaks, redaction working, auth flow solid  
* \[ \] Documentation: user guide, operator runbook  
* \[ \] **Milestone:** Production-ready for hackathon submission

---

## **14\. Out of Scope (v1)**

* Privy integration (Bags handles auth)  
* DFlow integration (no prediction markets needed)  
* DLMM pools (cannot be permanently locked)  
* Custom on-chain programs (use existing Bags \+ Meteora programs)  
* Multi-sig or DAO governance for strategies  
* Advanced rebalancing (position range adjustment after lock)  
* iOS/Android native app (web-only for Bags App Store)  
* KYC/compliance features  
* Fee share configuration with \> 100 recipients (hard limit per Bags API)

---

## **15\. Open Questions for Resolution Before GSD Execution**

1. **Bags App Store container:** What is the technical spec for embedded apps? React? iframe? Component library? → Contact `apps@bags.fm`  
2. **Bags Agent session refresh:** Can sessions be programmatically refreshed without user interaction? If not, what's the maximum automation window?  
3. **DAMM v2 config keys:** Which pre-existing config keys are available for permissionless pool creation? Or does PinkBrain LP need to use `createCustomPool` (which has restrictions on token leakage)?  
4. **Fee share configuration as a feature:** Does PinkBrain LP also configure fee sharing (the 100-recipient BPS allocation), or does it only consume already-configured fee streams? This changes whether the app needs the `/fee-share/config` write endpoints.  
5. **Hackathon submission deadline:** Exact date not published — monitor `bags.fm/hackathon` and `@BagsHackathon` on X for announcements.

---

## **16\. Repo and Dependency Inventory**

### **Application Repos (to be created)**

| Repo | Purpose | Language |
| ----- | ----- | ----- |
| `pinkbrain-lp-backend` | API server, compounding engine, scheduler | TypeScript/Node.js |
| `pinkbrain-lp-frontend` | Bags App Store embedded UI | TypeScript/React |

### **External Dependencies**

| Package | Version | Purpose |
| ----- | ----- | ----- |
| `@solana/web3.js` | latest | Solana RPC, transaction building |
| `@meteora-ag/cp-amm-sdk` | latest | DAMM v2 pool operations |
| `bags-sdk` (if published) | latest | Bags API client (or build from API docs) |
| `helius-sdk` | latest | Priority fees, webhooks, DAS API |
| `bn.js` | latest | Big number math for liquidity calculations |
| `bullmq` or `agenda` | latest | Job scheduling and queue management |
| `pino` | latest | Structured logging with redaction |

### **Reference Repos (read-only, for patterns)**

| Repo | Use |
| ----- | ----- |
| `github.com/MeteoraAg/damm-v2-sdk` | SDK source, examples, docs.md |
| `github.com/MeteoraAg/meteora-pool-setup` | Pool creation scripts and config examples |
| `github.com/bagsfm/bags-sdk` | Official Bags SDK |
| `github.com/bagsfm/bags-idl` | Bags program IDL for raw instruction building |
| `github.com/sendaifun/skills/tree/main/skills/meteora` | Meteora integration patterns |
| `github.com/tenequm/skills/tree/main/skills/solana-development` | Solana dev patterns |
| `github.com/solana-foundation/solana-dev-skill` | Solana reference |

---

## **17\. GSD Handoff Checklist**

* \[x\] Consolidated PRD with resolved conflicts  
* \[x\] Meteora product decision: DAMM v2 (not DLMM) — with SDK references  
* \[x\] Swap routing decision: Bags API (not Jupiter) — with endpoint references  
* \[x\] Custody model decision: Bags Agent auth  
* \[x\] Top-100 definition: per-strategy, configurable exclusion list  
* \[x\] Data models defined  
* \[x\] Internal API defined  
* \[x\] State machine for compounding runs defined  
* \[x\] Security requirements documented  
* \[x\] Implementation roadmap with phases  
* \[ \] Bags App Store technical spec (pending — contact Bags team)  
* \[ \] Bags Agent session refresh behavior (pending — test or confirm with docs)  
* \[ \] DAMM v2 config key availability (pending — check Meteora config list)  
* \[ \] Hackathon submission deadline (pending — monitor)

---

*This document supersedes all prior PinkBrain LP specifications. Any implementation detail from earlier documents that contradicts this PRD should be discarded.*

**Product Requirements Document for PinkBrain LP on Bags**

## **Executive summary**

**PinkBrain LP** (working name) is a fee-compounding fee-sharing app intended to live in the Bags in-app “App Store” ecosystem (including the Hackathon track context). It is described as an app that (a) **collects fees from Bags distributions**, (b) **swaps those fee proceeds into two user-selected Solana tokens**, and (c) **adds them as liquidity on Meteora**, with the LP position **locked permanently** while continuing to earn fees (and allowing those earned fees to be claimed).

The core implementation challenge is to deliver **automated, repeatable compounding** (claim → swap → add liquidity → lock) while meeting the requirements that:

* fees can be directed to **up to 100 recipients** (top users or token owner, per the input), and  
* “all revenue must pass through the proper setups for Bags.fm using their APIs and keys,” implying the system must use official Bags mechanisms for fee sharing and claiming rather than bypassing them.

This PRD is structured for handoff to **GSD** for detailed specification and execution. Items not explicitly defined in the user input or in primary documentation are labeled **Unknown/TBD** and called out as required inputs.

## **Problem statement and context**

### **Problem being solved**

Creators and communities on the Bags ecosystem want a “set-and-forget” way to turn fee income into **long-term, permanently locked liquidity** on Meteora—effectively an automated dividend/treasury engine that converts fee proceeds into a locked LP position that can continue to generate trading fees over time. Meteora’s DAMM v2 product explicitly supports enabling LPs to **permanently lock liquidity while still claiming earned fees**, aligning with the product intent.

### **Platform constraints that shape the product**

**Bags API** is the canonical integration surface for building fee workflows and token-related interactions. It uses **API key authentication via the `x-api-key` header**, and documents a **rate limit of 1,000 requests per hour per user and per IP**.

Key capabilities relevant to PinkBrain LP include:

* **Fee sharing configuration** supports multiple claimers (up to **100 fee claimers**) allocated in **basis points totaling 10,000**, and mentions lookup table requirements for larger configurations.  
* **Fee claiming** endpoints generate transactions to claim fees from multiple sources (virtual pools, DAMM v2 positions, etc.).  
* **Trading endpoints** provide quotes and construct swap transactions (`GET /trade/quote`, `POST /trade/swap`).

In addition to the public API key model, Bags also supports an **Agent authentication flow** (challenge posted to Moltbook, session expires in 15 minutes) and explicit wallet export capability (with a strong warning that it returns private keys).  
 This is highly relevant to automating compounding and must be treated as a **security-sensitive design decision**.

### **DeFi protocol constraints that shape the product**

Meteora supports multiple programs; for this product, DAMM v2 is the primary candidate because it supports NFT-backed LP positions, concentrated-liquidity price ranges, and liquidity locking mechanics.

Meteora DAMM v2 (cp-amm) mainnet program id is documented, and Meteora’s developer guide includes a centralized list of program IDs.

A critical product constraint: **DAMM v2 “Compounding Fee Mode” pools operate as constant-product pools “with no concentrated liquidity range.”**  
 If PinkBrain LP requires “any range Meteora offers,” it should not rely on DAMM v2’s protocol-level compounding mode for range-based positions; instead it should implement **application-level compounding** (claim fees and re-add liquidity periodically).

## **Goals, scope, and success metrics**

### **Goals**

* Deliver a production-ready fee-sharing app that:  
  * Claims fee proceeds from Bags distributions using official Bags endpoints and credentials.  
  * Converts proceeds into **two user-selected SPL tokens** using a deterministic swap flow (quote → swap tx) built via Bags trading endpoints or a documented alternative.  
  * Creates or adds liquidity on Meteora DAMM v2 and **permanently locks** the resulting position, while ensuring fees remain claimable where supported.  
  * Supports fee routing to **up to 100 recipients** where the Bags fee-share mechanism is the governing primitive.  
* Provide GSD with a consolidated, repo-by-repo inventory and an executable plan with acceptance criteria, test cases, deployment strategy, and runbook.

### **Scope**

In scope:

* Configuration of fee routing (up to 100 recipients) and verification that basis points sum to 10,000.  
* Automated compounding loop: claim → swap → add liquidity → lock, with auditing, idempotency, and rollback safety.  
* User-facing UI aligned to Bags app conventions (visual spec is **Unknown** and must be supplied by user/Bags).  
* Observability and operations: monitoring, alerts, and operator workflows.

Out of scope (non-goals) unless explicitly added:

* Building a new on-chain AMM or custom DEX.  
* Serving as a general-purpose wallet or custody platform (custody model must be explicitly decided).  
* Prediction-market functionality or KYC; DFlow prediction markets require Proof verification and geoblocking considerations.  
   (DFlow/Privy are listed resources; their inclusion in the runtime product should be explicitly confirmed.)

### **Success metrics and KPIs**

Because product goals combine growth, reliability, and financial execution quality, success metrics should be tracked per strategy and globally:

**Adoption & engagement**

* Number of created strategies (per token, per owner).  
* Weekly active compounding strategies.  
* Number of unique fee recipients receiving payouts (capped at 100 per config).

**Financial outcomes**

* Total fees claimed from Bags and successfully processed (SOL and/or tokens).  
* Total swap volume executed via the app, and median slippage vs quoted.  
* Total value added to Meteora LP positions (in USD terms; pricing method **Unknown**).  
* LP fee revenue generated over time from positions (protocol-specific extraction method **Unknown**).

**Reliability & safety**

* Compounding job success rate.  
* Mean time to detect (MTTD) and mean time to recover (MTTR) for failed compounding runs.  
* Number of failed claims, failed swaps, or failed liquidity-add transactions per day.  
* Incidents involving credential exposure (target: 0).

## **Stakeholders, roles, and operating model**

### **Stakeholders**

* **Product Owner (User / Project Owner)**: owns product intent, approves scope, defines distribution rules (e.g., “top 100 users” definition). (Owner identity: **Unknown**.)  
* **GSD**: specification, execution planning, delivery coordination.  
* **Engineering**:  
  * Frontend engineering (Bags-embedded UI)  
  * Backend/platform engineering (compounding scheduler, integrations)  
  * Protocol integration engineering (Meteora interactions)  
* **Security**: threat modeling, secrets management, monitoring for abuse.  
* **Bags integration partner contact** (apps@bags.fm referenced on hackathon snippet; contact specifics are **Unknown** due to page rendering limits).

### **Roles and responsibilities**

* **PM/Owner**: defines requirements, signs off acceptance criteria, decides custody model and distribution rule semantics.  
* **Tech Lead**: owns architecture, key technical decisions, performance/security requirements, code review bar.  
* **Backend Engineer**: implements compounding pipeline, storage, APIs, job orchestration.  
* **Protocol Engineer**: implements Meteora DAMM v2 integrations, lock/unlock semantics validation, fee claiming.  
* **Frontend Engineer**: builds Bags-consistent UI; integrates with backend APIs; ensures safe transaction UX.  
* **QA**: defines test plans, executes test matrix, verifies correctness and failure modes.  
* **DevOps/SRE**: environments, CI/CD, monitoring, runbooks, incident response.

## **Product requirements**

### **Detailed feature list**

**Strategy creation and configuration**

* User selects:  
  * Source fee stream(s) to compound (exact Bags fee source type(s): **Unknown**; likely “claimable positions” and/or partner config stats).  
  * Two target token mints (“any two tokens on Solana,” per input; allow-listing vs open is **TBD**).  
  * Swap parameters (slippage tolerance, route constraints, max price impact; **TBD**).  
  * Meteora pool type and price range configuration:  
    * If using DAMM v2 concentrated ranges, require range inputs and validate against Meteora constraints (range model: **TBD**).  
  * Lock settings: permanent lock is required, but whether it locks initial liquidity only or also subsequent adds is **Unknown**.  
  * Fee recipients and allocations (up to 100, BPS sum 10,000).

**Compounding engine**

* Scheduled job (cron-like) and/or event-driven trigger executes:  
  1. Discover claimable fees for the strategy (wallet or position).  
  2. Generate claim transactions from Bags API and submit them.  
  3. Swap claimed proceeds into target token A and token B using Bags trade quote \+ swap flow.  
  4. Add liquidity on Meteora DAMM v2 and lock the position.  
  5. Record outcomes (tx signatures, amounts, fees, slippage, timing).

**Distribution logic**

* Support distribution to:  
  * Up to 100 explicit recipients via Bags fee-share config creation (if this app is configuring fee share for a token) or via a separate distribution mechanism (**Unknown**).  
  * “Top 100 users” rule requires a concrete definition and data source (e.g., top claimers by fees, top holders, top traders). This is **Unknown** and must be supplied.

**User interface**

* Embedded UI matching Bags style.  
* Views:  
  * Strategy list (status, next run, lifetime compounded)  
  * Strategy detail (token pair, recipients, lock status, last run logs)  
  * Manual “run now” with confirmation  
  * Admin controls (pause/resume, rotate keys) for owners/operators only

**Observability**

* Metrics dashboard and alerting:  
  * job success/failure  
  * claim and swap failure categories  
  * RPC latency  
  * queue depth/backlog  
  * abnormal slippage detection

### **User stories**

* As a token/project owner, I want to create a “locked LP compounding strategy” so that my ongoing fee income becomes permanent liquidity over time without manual operations.  
* As a recipient, I want transparency into how much was compounded vs paid out, and the transaction history proving it.  
* As an operator, I want safe pause/resume controls and idempotent re-runs so I can recover from RPC outages or failed swaps without double-spending.

### **Acceptance criteria**

**Strategy configuration**

* System rejects any recipient configuration where basis points do not sum to 10,000.  
* System rejects recipient count \> 100\.  
* System stores token addresses in base58 public key format consistently with Bags/Solana conventions.

**Compounding execution**

* For each run, the system creates an immutable audit record with:  
  * input balances/claimable amounts,  
  * quotes received,  
  * signed transactions submitted,  
  * confirmed tx signatures,  
  * resulting LP position updates.  
* System is idempotent: retrying a run after partial failure does not duplicate swaps or duplicate liquidity adds (exact idempotency key design: **TBD**).

**Security**

* No private keys are logged.  
* If using Bags Agent wallet export, the system stores exported keys only in approved secrets storage; use is auditable.  
* All external API calls include appropriate authentication headers and follow rate limits.

## **Technical inventory and dependencies**

### **Missing inputs the user must supply**

The PRD can proceed to implementation only after the following are provided (Unknown → required):

* The **canonical list of repositories** to be delivered (the input currently contains skills repos and docs; the actual app repos are **Unknown**).  
* Whether compounding runs are executed using:  
  * a project-owned hot wallet,  
  * a Bags Agent wallet,  
  * or an on-chain permissionless mechanism. (Custody model is **Unknown**.)  
* Definition of **“top 100 users”** and the authoritative data source.  
* UI requirements: reference Bags UI patterns, component library, navigation constraints.  
* Target environments and hosting constraints (Vercel vs container vs serverless; **Unknown**).  
* Production RPC provider decision (Helius vs other) and expected throughput.

### **Repo and library comparison table**

The following table covers *only the repositories explicitly listed in the input* plus one strongly relevant official repo (Solana dev skill) that supports execution quality; any actual PinkBrain LP application repos are **Unknown** and must be added.

| Item | Type | Repo URL (in code) | Primary language | Default branch | CI/CD | Build/Test commands | License | Issues / PRs | Maintainers | Dependency graph | Onboarding effort |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| QuikNode Solana/Anchor Claude skill | Repo | `https://github.com/quiknode-labs/solana-anchor-claude-skill` | Unknown (likely Markdown) | `main` | No workflows observed (Unknown) | Install via `npx skills add …` | MIT | Issues: 0; PRs: 0 | Unknown | Unknown | 0.5–1 hr (est.) |
| DFlow \+ Phantom connect skill | Repo | `https://github.com/DFlowProtocol/dflow_phantom-connect-skill` | Shell (100%) | `main` | No workflows observed (Unknown) | `./install.sh` or copy `skill/` folder | MIT | PRs: 0; Issues: Unknown/Not visible | Unknown | None (skill content) | 0.5–1 hr (est.) |
| SendAI Solana skills marketplace | Repo | `https://github.com/sendaifun/skills` | TypeScript, Rust | `main` | Unknown | Install via plugin / marketplace flow | Apache-2.0 | Issues: 1; PRs: 4 | Unknown | Unknown | 1–2 hrs (est.) |
| SendAI Meteora skill module | Module (subdir) | `https://github.com/sendaifun/skills/tree/main/skills/meteora` | Markdown/content | Inherits repo | Inherits repo | N/A | Inherits repo | Inherits repo | Unknown | N/A | 0.5–1 hr (est.) |
| Tenequm skills | Repo | `https://github.com/tenequm/skills` | Python, Shell | `main` | GitHub Actions CI runs pre-commit via uv | `uvx pre-commit run --all-files` (from workflow) | MIT | Issues: 0; PRs: 0 | Unknown | Unknown | 1–2 hrs (est.) |
| Solana Foundation Solana dev skill | Repo | `https://github.com/solana-foundation/solana-dev-skill` | TypeScript, Shell | `main` | Unknown | Install via `npx skills add …` | MIT | Issues: 6; PRs: 5 | Solana Foundation (implied) | Unknown | 1–2 hrs (est.) |

### **External documentation and API dependencies**

| Dependency | What it’s used for | Auth | Key constraints |
| ----- | ----- | ----- | ----- |
| Bags public API | Fee claiming, fee share config, trade quote \+ swap tx creation | `x-api-key` header | Rate limit: 1,000 req/hr per user+IP |
| Bags agent API | Programmatic agent auth \+ wallet list/export (automation) | Token from agent auth (JWT-like, session flow) | Wallet export returns private keys; must be secured |
| Solana JSON-RPC | Blockchain calls (balances, tx status, program state) | Provider-dependent | Must handle commitment levels and tx versioning |
| Helius Solana RPC | RPC \+ enhanced methods and parameters (e.g., changedSinceSlot on getProgramAccounts) | Provider account/API key (exact auth: **Unknown**) | Performance and reliability requirements depend on plan |
| Meteora DAMM v2 | Liquidity pools, position NFTs, lock/vesting mechanics | On-chain | Compounding fee mode eliminates concentrated ranges |
| Privy (optional) | User auth \+ embedded wallets; supports Sign-In With Solana | Privy dashboard \+ SDK/keys (details: **Unknown**) | Only needed if Bags-provided wallet UX is insufficient |
| DFlow (optional) | Trading APIs; KYC required for prediction markets, not for spot | API key model (request key) | If used, adds compliance requirements |

## **Architecture, APIs, and non-functional requirements**

### **Architecture overview**

A pragmatic architecture that minimizes new on-chain development while enabling automation:

**Frontend (Bags-embedded UI)**

* Displays strategies, history, and status.  
* Requests compounding actions (manual run, pause) via backend.

**Backend services**

* **Strategy service**: stores strategy configs (token pair, recipients, ranges, schedules).  
* **Compounding orchestrator**: scheduled executor with idempotency and retries.  
* **Bags integration client**:  
  * claimable position discovery,  
  * claim tx generation,  
  * trade quote and swap tx generation.  
* **Meteora integration client**:  
  * add liquidity,  
  * permanent lock position,  
  * fee claim tracking where applicable.  
* **RPC adapter** (Helius or other): tx submission/confirmation and state reads.

**Data store**

* Strategy configuration database.  
* Audit log store (immutable events) \+ metrics store.

**Key management**

* One of:  
  * operator-managed signing key(s),  
  * Bags agent wallet(s),  
  * or an on-chain controlled mechanism.  
* This is the single highest-risk unknown and must be decided before implementation, particularly because Bags supports exporting wallet private keys.

### **External integration points and APIs**

**Bags API**

* Base URL: `https://public-api-v2.bags.fm/api/v1/`  
* Auth: `x-api-key` header  
* Rate limit: 1,000 requests/hour/user+IP  
* Key endpoints (representative, not exhaustive):  
  * Fee share config creation: `POST /fee-share/config` (supports up to 100 claimers)  
  * Claimable positions: `GET /token-launch/claimable-positions`  
  * Claim transactions: `POST /token-launch/claim-txs/v2`  
  * Trade quote: `GET /trade/quote`  
  * Create swap tx: `POST /trade/swap`

**Meteora**

* DAMM v2 program id: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`  
* Permanent locking supported (`permanent_lock_position` is explicitly documented).

**Solana RPC**

* JSON-RPC request formatting and standard method semantics follow Solana documentation.

### **Data models**

Because the user input does not define schemas, below are proposed canonical models for GSD to refine:

**Strategy**

* `strategyId` (UUID)  
* `ownerWallet` (base58 pubkey)  
* `source` (enum; examples: `BAGS_CLAIMABLE_POSITIONS`, `BAGS_PARTNER_CONFIG`, **TBD**)  
* `targetTokenA`, `targetTokenB` (mint pubkeys)  
* `swapConfig`:  
  * `slippageBps` (default TBD)  
  * `maxPriceImpactBps` (TBD)  
* `meteoraConfig`:  
  * `program`: `DAMM_V2`  
  * `poolAddress` (optional; create vs join is TBD)  
  * `range`: `{ minPrice, maxPrice }` or bin/range fields (TBD)  
  * `lockMode`: `PERMANENT`  
* `recipients[]`:  
  * `wallet`  
  * `bps`  
  * (optional) `role`: `OWNER`, `TOP_USER`, etc (TBD)  
* `schedule` (cron or interval)  
* `status`: `ACTIVE|PAUSED|ERROR`  
* `createdAt`, `updatedAt`

**CompoundingRun**

* `runId`, `strategyId`  
* `startedAt`, `finishedAt`  
* `claim`: input/output amounts, tx signatures  
* `swap`: quote snapshots \+ executed amounts, tx signatures  
* `liquidityAdd`: amounts, position NFT, lock tx signature  
* `result`: `SUCCESS|FAILED|PARTIAL`  
* `errorCode`, `errorDetail` (if any)

### **Internal APIs (proposed)**

All internal endpoints should be versioned (`/v1/…`) and require auth (JWT or session-based; **Unknown** how Bags embedding authenticates).

* `POST /v1/strategies` create strategy  
* `GET /v1/strategies` list strategies  
* `GET /v1/strategies/{id}` strategy detail  
* `POST /v1/strategies/{id}/pause`  
* `POST /v1/strategies/{id}/resume`  
* `POST /v1/strategies/{id}/run` (manual run)  
* `GET /v1/strategies/{id}/runs` run history  
* `GET /v1/runs/{runId}` run detail/audit

### **Security, compliance, and performance requirements**

**Security**

* Treat any mechanism exporting or storing private keys as high risk; Bags explicitly warns that wallet export returns actual private keys.  
* Principle of least privilege:  
  * Separate API keys for read vs trade if possible (capabilities model is **Unknown** in Bags).  
* Transaction integrity:  
  * Require deterministic signing pipelines and strict replay protection (nonce/slot constraints).  
* Secrets:  
  * Store in a managed secret manager; rotation policy **TBD**.

**Compliance**

* If integrating DFlow prediction markets, Proof/KYC is required; spot trading does not require Proof.  
   PinkBrain LP should avoid implicit adoption of KYC-bearing features unless explicitly required.

**Performance**

* Must remain within documented Bags API rate limits, implement backoff, and batch operations where possible.  
* RPC resiliency: implement multi-endpoint failover (Helius \+ fallback provider) (TBD).

## **Delivery plan, QA, and operational readiness**

### **Deployment plan, environments, rollback strategy, and monitoring**

**Environments**

* `dev`: local/testnet where possible; if mainnet-only features are required, use minimal-value test wallets.  
* `staging`: production-like; restricted strategy set.  
* `prod`: full scale.

**Deployment**

* CI: lint, unit tests, and integration tests.  
* CD: canary deploy backend; feature-flag strategies.

**Rollback**

* Backend rollback via previous image/deploy.  
* Compounding run rollback must be logical:  
  * If claim succeeded but swap failed, do not auto-swap again unless reconciled.  
  * If swap succeeded but liquidity add failed, tokens remain in wallet—must be reconciled, not re-swapped.

**Monitoring**

* Metrics:  
  * job success rate, latency, queue size  
  * swap slippage distribution  
  * RPC error rates  
* Alerts:  
  * repeated failures per strategy  
  * missing runs beyond schedule  
  * abnormal slippage or sandwich-risk patterns  
* Logging:  
  * structured logs with redacted secrets  
  * trace IDs per run

### **Migration and backwards-compatibility notes**

* Bags fee share program versions exist (v1 legacy, v2 current). Compatibility is required when claiming fees from older positions or vault types (exact mapping is **TBD**, but Bags documents both and highlights v2 as current).  
* Meteora DAMM v2 compounding fee mode conflicts with “concentrated liquidity range” requirement; ensure the product uses a strategy compatible with required pool configuration.

### **Risk assessment and mitigation**

**Custody & key exposure risk**

* Risk: exporting/storing keys (Bags agent wallet export) could leak private keys.  
* Mitigation: avoid key export if possible; if unavoidable, enforce HSM/KMS storage, strict access logs, and per-strategy isolation.

**Economic execution risk**

* Risk: slippage, MEV, route quality.  
* Mitigation: conservative slippage defaults, max price impact caps, monitoring for abnormal execution.

**Protocol constraint risk**

* Risk: inability to add liquidity to permanently locked positions, or inability to lock subsequent liquidity adds.  
* Mitigation: validate with Meteora DAMM v2 docs and/or dev support; build a proof-of-concept against devnet/mainnet small amounts.

**Platform/API constraints**

* Risk: rate limit impact during spikes.  
* Mitigation: schedule jitter, batching, backoff per documented limits.

### **Implementation roadmap with milestones and time estimates**

Assumptions:

* Start date: 2026-03-30 (nearest Monday after current date context).  
* Sprint length: 2 weeks.  
* Owners are roles; names are TBD.

Apr 05 Apr 12 Apr 19 Apr 26 May 03 May 10 May 17 May 24 May 31Confirm custody model, fee sources, "top 100" definition     Finalize UI spec aligned to Bags app patterns                Bags claim \+ trade pipeline POC (dev/staging wallet)         Meteora DAMM v2 add-liquidity \+ permanent lock POC           Backend strategy service \+ scheduler \+ audit log             Frontend UI (create strategy, view runs, controls)           Observability (metrics, alerts, dashboards)                  Security review \+ secrets management \+ threat model          End-to-end tests \+ load tests \+ failure-mode drills          Staging rollout \+ canary strategies                          Production release \+ runbook \+ on-call readiness             Discovery and specificationPrototypeBuildHardeningLaunchPinkBrain LP delivery plan (draft)

### **QA plan and test cases**

**Unit tests**

* Validate bps summation to 10,000 and max 100 recipients.  
* Validate idempotency key generation rules (TBD).  
* Validate token mint and wallet pubkey format assumptions.

**Integration tests**

* Bags:  
  * Fetch claimable positions, generate claim txs, submit tx, verify resulting balances.  
  * Quote \+ swap tx creation path; validate swap tx fields returned.  
* Meteora:  
  * Add liquidity; verify position NFT minted; execute permanent lock; verify lock state persists.

**End-to-end tests**

* Full compounding run:  
  * claim → swap → add liquidity → lock → record/observe  
* Failure paths:  
  * claim fails (retry with backoff)  
  * swap quote works but swap tx fails (stop; do not re-quote infinitely)  
  * add liquidity fails after swap (ensure assets remain available; safe retry)

### **Handoff checklist and operational runbook**

**Handoff checklist (to GSD and execution teams)**

* Final PRD \+ finalized list of repos (app repos currently missing).  
* Signed-off custody model and key management plan.  
* “Top 100 users” definition and data source documented.  
* API credentials provisioning plan (Bags dev keys, agent keys if needed).  
* Environments defined, deployment pipeline defined, secret rotation policy set.  
* Observability dashboard and alert thresholds established.

**Operational runbook (minimum)**

* Daily checks:  
  * compounding success rate and backlog  
  * abnormal slippage alerts  
* Incident response:  
  * pause strategy  
  * rotate API keys  
  * revoke compromised keys and re-deploy (procedure TBD)  
* Recovery:  
  * reconcile partial runs (claim-only, swap-only) with deterministic state machine transitions  
* Security:  
  * periodic access review to secrets storage  
  * verify no private keys logged, especially if using agent wallet export.

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>