#!/usr/bin/env python3
"""Generates src/game/ministryEvents.ts with 100+ events per ministry across
corruption, betrayal, improvement, and upgrade (common, rare, epic, legendary),
plus foreign country emergency money request / bailout events.
"""

import json

MINISTRIES = ['finance', 'foreign', 'defense', 'industry', 'interior', 'health']
CATEGORIES = ['corruption', 'betrayal', 'improvement', 'upgrade']
RARITIES = (
    ['common'] * 10 +
    ['rare'] * 8 +
    ['epic'] * 5 +
    ['legendary'] * 2
)

# 25 thematic titles and plot seeds for each (ministry, category)
DATA = {
    ('finance', 'corruption'): [
        ("Offshore Shell Account", "Investigators discover an undeclared shell company linked to senior revenue commissioners.", "common"),
        ("The Phantom Payroll", "Auditors uncover dozens of ghost employees drawing salaries from the national mint.", "common"),
        ("Customs Kickback Syndicate", "Port customs officials have been taking bribes to clear container shipments without duty.", "common"),
        ("Discretionary Slush Fund", "A hidden discretionary ledger at the treasury has been paying for cabinet hospitality.", "common"),
        ("Audit Suppression Bribery", "A major conglomerate paid treasury inspectors to bury an unfavorable tax audit.", "common"),
        ("Unrecorded Bond Auction", "Secondary bond tranches were quietly allocated to favored private brokerages below market price.", "common"),
        ("VAT Refund Scam", "A carousel fraud network exploited value-added tax export loopholes to siphon state funds.", "common"),
        ("Shadow Invoicing Scandal", "Inflated government procurement invoices were routed through minister-owned consultancies.", "common"),
        ("Luxury Procurement Fraud", "Treasury offices were refitted with imported marble and artisan furnishings under defence codes.", "common"),
        ("Real Estate Tax Evasion", "High-ranking officials systematically under-declared luxury property values to evade rates.", "common"),
        ("Central Bank Favoritism", "A private commercial bank received uncollateralized emergency liquidity through backdoors.", "rare"),
        ("Sovereign Gold Arbitrage", "Custodial staff at the national reserve secretly loaned state bullion to private traders.", "rare"),
        ("Cartel Debt Clearance Bribe", "A shadow financier offered millions to erase tax liens held against syndicated holdings.", "rare"),
        ("Secret Tariff Exemption", "A covert decree exempted a politically-connected importer from heavy strategic tariffs.", "rare"),
        ("State Pension Fund Embezzlement", "Substantial capital from the civil service pension reserve was diverted into speculative ventures.", "rare"),
        ("Insider Trading on Rate Cuts", "Draft interest rate announcements were leaked to private traders ahead of official release.", "rare"),
        ("Foreign Account Discrepancy", "International financial monitors flag multimillion-dollar deposits in unmonitored Swiss trusts.", "rare"),
        ("Falsified Revenue Projections", "Treasury analysts were ordered to cook revenue models to mask a widening fiscal hole.", "rare"),
        ("Sovereign Bond Rigging Scheme", "A cabal of syndicate banks and finance ministry insiders manipulated sovereign yields.", "epic"),
        ("Billionaire Tax Shelter Conspiracy", "A systemic network of bespoke tax shelters was engineered for the country's wealthiest oligarchs.", "epic"),
        ("Treasury Core System Skimming", "A microscopic rounding-algorithm backdoor diverted millions from daily transaction clearing.", "epic"),
        ("Ministerial Estate Raid", "Investigators raid a luxury chateau owned by a treasury deputy, discovering millions in gold bullion.", "epic"),
        ("National Debt Black Book", "A secret ledger reveals that sovereign liabilities have been intentionally concealed from parliament.", "epic"),
        ("The Grand Sovereign Vault Embezzlement", "An audacious multi-billion-dollar heist from the central reserves was orchestrated from within the ministry.", "legendary"),
        ("Global Shadow Banking Laundromat", "The treasury's correspondent accounts were transformed into an international money-laundering pipeline.", "legendary"),
    ],
    ('finance', 'betrayal'): [
        ("Leaked Tax Reform Draft", "A draft of impending corporate tax hikes was leaked to business federations to spark outrage.", "common"),
        ("Currency Depreciation Rumors", "Whispers spread by treasury staff cause panic selling of the national currency.", "common"),
        ("Insider Defection to Private Banking", "A key debt manager resigns abruptly to take a lucrative position at a hostile hedge fund.", "common"),
        ("Secret Deficit Leak", "Classified quarterly cashflow reports were handed to opposition leaders on the eve of debate.", "common"),
        ("Subverting Anti-Graft Commission", "Treasury liaisons actively tipped off targets of upcoming anti-corruption investigations.", "common"),
        ("Quiet Collusion with Defaulting Creditors", "A senior debt officer advised foreign bondholders on legal tactics to attach state assets overseas.", "common"),
        ("Sabotaged Revenue Software", "A critical tax collection database migration was deliberately corrupted from within.", "common"),
        ("Unauthorized Foreign Loan Talks", "Envoys from the debt office were caught negotiating back-channel credit with predatory syndicates.", "common"),
        ("Treasury Memo Handed to Press", "An internal memo describing the national debt limit as 'unsustainable' leads the morning papers.", "common"),
        ("Treasury Defiance on Budget Cuts", "Senior civil servants refuse to implement austerity measures approved by the administration.", "common"),
        ("Leaking Sovereign Reserve Figures", "Precise figures on usable foreign exchange reserves were transmitted to foreign speculators.", "rare"),
        ("Hedge Fund Collusion", "Treasury insiders provided advance notice of bond issuances to short-selling foreign funds.", "rare"),
        ("Shorting National Debt", "A network of treasury analysts held private derivatives betting directly on national credit downgrades.", "rare"),
        ("Secret Wealth Exfiltration", "High-level bureaucrats quietly moved their personal fortunes into offshore safe havens.", "rare"),
        ("Fictitious Budget Deficit Panic", "Rogue accountants published alarming false deficits to trigger a market selloff and cabinet crisis.", "rare"),
        ("Unauthorized Debt Repurchase", "Public funds were illegally committed to buying back bonds held by the minister's associates.", "rare"),
        ("Concealing Sovereign Liabilities", "Treasury directors hid contingent bailout liabilities to pass falsified budget audits.", "rare"),
        ("Finance Minister Defection Threat", "The minister of finance threatens to resign publicly and denounce government spending unless granted veto power.", "rare"),
        ("Hostile Speculator Cartel Alliance", "A senior financial official conspired with a foreign consortium to orchestrate a run on national debt.", "epic"),
        ("Compromised Central Bank Encryption", "Master cryptographic keys for sovereign interbank settlements were transferred to foreign entities.", "epic"),
        ("Sovereign Default Sabotage Plan", "A faction inside the debt office drafted an unauthorized default declaration to topple the government.", "epic"),
        ("Leaking Emergency Fiscal Contingencies", "The state's top-secret wartime financial reserves blueprint was leaked to adversarial intelligence.", "epic"),
        ("International Credit Rating Sabotage", "Confidential cherry-picked internal data was supplied to rating agencies to force a downgrade.", "epic"),
        ("Conspiracy to Crash National Currency", "A treasonous clique within the central bank executed coordinated foreign sales to destabilize the currency.", "legendary"),
        ("Sovereign Financial Coup Plot", "The finance ministry leadership coordinated with private banks to freeze government liquidity and force capitulation.", "legendary"),
    ],
    ('finance', 'improvement'): [
        ("Streamlined Tax Filing Portal", "A newly digitized tax filing system reduces compliance friction and boosts early returns.", "common"),
        ("Unannounced Treasury Audit Yield", "Surprise inspections at regional customs points uncover uncollected duties.", "common"),
        ("Voluntary Compliance Bump", "Public outreach campaigns persuade thousands of citizens to regularize back taxes.", "common"),
        ("Recovered Corporate Arrears", "The debt recovery taskforce successfully negotiates the collection of long-overdue corporate levies.", "common"),
        ("Municipal Debt Restructuring", "Consolidating regional municipal bonds lowers overall sovereign debt service charges.", "common"),
        ("Tariff Invoicing Transparency", "Electronic container scanning eliminates billing disputes and increases border collections.", "common"),
        ("Interest Rate Negotiation Win", "The treasury secures more favorable repayment spreads from international commercial lenders.", "common"),
        ("Clamping Down on Expense Padding", "A rigorous procurement review cuts wasteful departmental travel and consulting overhead.", "common"),
        ("Treasury Staff Professionalization", "Civil service training cohorts improve tax assessment turnaround and accuracy.", "common"),
        ("Overdue Arrears Collection", "Targeted settlement offers bring in sudden revenue from legacy disputes.", "common"),
        ("Algorithmic Fraud Detection Surge", "Machine-learning classifiers identify fraudulent tax deductions across commercial filings.", "rare"),
        ("Sovereign Bond Oversubscription", "International investors line up for new 10-year bonds, yielding capital at lower yields.", "rare"),
        ("Offshore Asset Repatriation Window", "A well-crafted amnesty window encourages wealthy citizens to repatriate capital from abroad.", "rare"),
        ("Syndicated Debt Relief Deal", "Diplomatic debt renegotiation reduces annual debt servicing obligations significantly.", "rare"),
        ("Tax Loophole Closure Triumph", "Closing aggressive transfer-pricing schemes yields major additional corporate revenues.", "rare"),
        ("Surplus Revenue Windfall", "Unexpectedly robust economic turnover leaves the treasury with cash exceeding quarterly targets.", "rare"),
        ("Debt Servicing Cost Reduction", "Proactive refinancing swaps high-interest short-term debt for stable long-term sovereign notes.", "rare"),
        ("International Tax Haven Cooperation", "Cross-border tax treaties allow the recovery of hidden taxable assets from overseas havens.", "rare"),
        ("National Sovereign Wealth Dividend", "Investments from the national reserve portfolio yield an extraordinary fiscal return.", "epic"),
        ("Historic Debt-to-GDP Landmark", "Disciplined fiscal management leads to the sharpest single-turn reduction in national debt ratios.", "epic"),
        ("Zero-Leakage Budget Milestone", "Full electronic tracking achieves an unprecedented quarter with zero unaccounted public expenditures.", "epic"),
        ("Comprehensive Fiscal Modernization", "The finance ministry completes a sweeping reform of national taxation and expenditure systems.", "epic"),
        ("Triple-A Credit Rating Upgrade", "Major global credit rating agencies upgrade national bonds to prime investment grade.", "epic"),
        ("The Golden Treasury Century Accord", "The nation secures historic century-long financing on terms that guarantee generational fiscal stability.", "legendary"),
        ("Sovereign Economic Autonomy Declaration", "Total elimination of external creditor dependence establishes unquestioned fiscal independence.", "legendary"),
    ],
    ('finance', 'upgrade'): [
        ("Automated Electronic Tax Receipts", "Deploying electronic billing systems enables instantaneous sales tax reconciliation.", "common"),
        ("High-Frequency Bond Auction Terminal", "Modernizing bond auction software widens institutional investor participation.", "common"),
        ("Standardized Public Accounting Reform", "Modern double-entry bookkeeping standards are mandated across all provincial bureaus.", "common"),
        ("Digital Customs Inspection Terminal", "Installing automated tariff verification systems speeds border throughput.", "common"),
        ("Modern Treasury Dashboard Deployment", "Cabinet gains real-time visibility into daily revenue inflows and departmental outlays.", "common"),
        ("Public Debt Tracking Overhaul", "An integrated debt ledger system improves maturity scheduling and liquidity forecasting.", "common"),
        ("Financial Inspectorate Re-equipment", "Auditors receive mobile forensics hardware to inspect remote corporate operations.", "common"),
        ("Centralized Payroll Automation", "Replacing manual payroll processing cuts administrative overhead across the civil service.", "common"),
        ("Macroeconomic Forecasting Suite", "Statistical modeling tools sharpen national growth and inflation projections.", "common"),
        ("Tax Cadastre Satellite Mapping", "High-resolution satellite mapping identifies unregistered commercial facilities.", "common"),
        ("Real-Time Digital Clearinghouse", "Interbank transactions settle instantly through a secure national central bank switch.", "rare"),
        ("Automated Banking Audit Neural Net", "Automated anomaly-detection software screens all high-value domestic financial transfers.", "rare"),
        ("Sovereign Green Bond Framework", "Issuing certified sustainable debt instruments attracts ESG investment capital.", "rare"),
        ("National Liquidity Reserve Facility", "A dedicated emergency liquidity pool is established to buffer against external financial shocks.", "rare"),
        ("Encrypted Financial Telecom Grid", "Military-grade optical lines secure communications between the treasury, mint, and central bank.", "rare"),
        ("Integrated Tariff Valuation Pipeline", "Direct integration with global commodity indices prevents import misinvoicing.", "rare"),
        ("Autonomous Tax Enforcement Division", "An elite, well-resourced investigative taskforce is deployed to pursue high-net-worth tax evasion.", "rare"),
        ("Public Spending Transparency Engine", "A public portal exposes government contracts and disbursements to citizen oversight.", "rare"),
        ("Sovereign Wealth Algorithmic Management", "Algorithmic asset allocation optimizes returns on state reserve assets around the clock.", "epic"),
        ("Central Bank Digital Currency Pilot", "Deploying a state-backed digital currency lowers cash friction and crushes the informal cash economy.", "epic"),
        ("Quantum-Secured Sovereign Vault Network", "Quantum-resistant encryption protects the nation's core financial architecture and reserve logs.", "epic"),
        ("Next-Gen National Fiscal Command Center", "A state-of-the-art facility provides live operational telemetry on the entire macro economy.", "epic"),
        ("Automated Sovereign Debt Hedging Matrix", "Sophisticated options modeling shields the national budget against foreign exchange swings.", "epic"),
        ("Global Reserve Currency Architecture", "Our national currency is adopted by bilateral trade partners as a regional reserve medium.", "legendary"),
        ("Autonomous AI-Driven National Economy Engine", "A fully integrated automated fiscal and tax optimization system ensures peak revenue efficiency.", "legendary"),
    ],

    ('foreign', 'corruption'): [
        ("Visa Sale Racket", "Consular officials were caught selling expedited business visas to criminal syndicates.", "common"),
        ("Diplomatic Bag Contraband", "Embassy couriers abused diplomatic immunity to smuggle luxury goods and untaxed gems.", "common"),
        ("Luxury Diplomatic Retreat", "A multimillion-dollar international trade conference was held at an opulent tropical resort with little agenda.", "common"),
        ("Embassy Rent Kickbacks", "Chancery leases in foreign capitals were negotiated at inflated rates with kickbacks to the ambassador.", "common"),
        ("Foreign Contractor Bribes", "An overseas construction firm bribed foreign ministry staff to secure embassy renovation bids.", "common"),
        ("Honorary Consul Bribery", "Diplomatic passports and honorary consul titles were sold to questionable foreign financiers.", "common"),
        ("Bilateral Grant Diversion", "Development aid earmarked for neighboring schools was diverted into ministerial foundations.", "common"),
        ("Trade Delegation Nepotism", "VIP seats on high-level bilateral trade delegations were reserved for the minister's relatives.", "common"),
        ("Diplomatic Fuel Ration Smuggling", "Duty-free diplomatic fuel coupons were sold onto foreign black markets at hefty profit.", "common"),
        ("Chancery Art Procurement Scandal", "Original masterworks loaned to overseas embassies were quietly replaced with counterfeits.", "common"),
        ("Secret Foreign Lobbying Retainer", "A senior diplomat was secretly on the payroll of a rival state's sovereign wealth group.", "rare"),
        ("Embassy Real Estate Embezzlement", "Prime diplomatic land in a foreign metropolis was sold below value to a shell entity.", "rare"),
        ("Trade Quota Bribery Scheme", "Foreign agricultural quotas were secretly allocated to the highest covert bidder.", "rare"),
        ("Extradition Immunity Sale", "Foreign fugitives paid ministry intermediaries to stall bilateral extradition requests indefinitely.", "rare"),
        ("Counterpart Hospitality Extravaganza", "Massive unvouched slush funds were spent hosting foreign dignitaries at private casinos.", "rare"),
        ("Bilateral Tariff Carveout Graft", "Confidential trade negotiations were steered to protect industries funding the foreign minister.", "rare"),
        ("Consular Protection Protection Racket", "Expatriate businesses abroad were pressured to pay protection fees to embassy staff.", "rare"),
        ("Diplomatic Plate Smuggling Fleet", "Dozens of high-end vehicles imported under diplomatic exemption were resold illegally.", "rare"),
        ("Foreign Ministry Slush Fund Network", "A global web of unmonitored bank accounts operated under embassy covers without treasury oversight.", "epic"),
        ("Selling Sovereign Vote in UN Assembly", "Diplomats secretly accepted foreign bribes to alter the country's voting position on human rights.", "epic"),
        ("Commercial Treaty Espionage Payoffs", "Foreign trade negotiators paid ministry delegates for advance drafts of the state's red lines.", "epic"),
        ("Diplomatic Immunity for Cartel Kingpins", "Senior ministry figures issued diplomatic credentials to international drug cartel liaisons.", "epic"),
        ("Sovereign Concession Bribe Syndicate", "Bilateral treaties were drafted to hand national resource rights to foreign state conglomerates.", "epic"),
        ("Global Diplomatic Extortion Syndicate", "The foreign ministry leadership operated an international corporate blackmail network from consulates.", "legendary"),
        ("Sovereign Foreign Ministry Capture", "A rival superpower successfully bribed the entire diplomatic high command to act as its geopolitical proxy.", "legendary"),
    ],
    ('foreign', 'betrayal'): [
        ("Leaked Diplomatic Cables", "Frank assessments of foreign leaders from our ambassadors were leaked to international media.", "common"),
        ("Premature Treaty Announcement", "An ambassador announced a trade deal before cabinet approval, embarrassing the government.", "common"),
        ("Secret Backchannel Promises", "Envoys made unapproved verbal commitments regarding border concessions during bilateral talks.", "common"),
        ("Defection of Cultural Attache", "A cultural attache seeks asylum in an adversary's capital, criticizing our domestic policies.", "common"),
        ("Embassy Staff Whispering Campaign", "Diplomats spread rumors abroad that our current administration is facing imminent collapse.", "common"),
        ("Unauthorized Summit Abstention", "Our delegation boycotted a regional summit without presidential authorization.", "common"),
        ("Chancery Communications Tampering", "Diplomatic cables between the capital and our premier embassy show signs of internal interception.", "common"),
        ("Foreign Ambassador Secret Dinners", "The foreign minister was photographed attending private, unannounced dinners with a hostile envoy.", "common"),
        ("Unsanctioned Treaty Compromise", "Our chief trade negotiator conceded critical intellectual property rights without cabinet consent.", "common"),
        ("Consular Whistleblower Scandal", "A disgruntled consul released confidential files documenting government surveillance of exiles.", "common"),
        ("Leaking Bilateral Red Lines", "Our confidential negotiating positions on territorial borders were supplied to foreign counterparts.", "rare"),
        ("Selling Intelligence to Rival Envoys", "A senior diplomat sold military and trade assessments to foreign intelligence handlers.", "rare"),
        ("Ambassadorial Defection to Rival State", "A prominent ambassador formally defects to a rival power, offering confidential state secrets.", "rare"),
        ("Secret Defense Agreement Leak", "Classified security annexes of a bilateral mutual defense pact were made public.", "rare"),
        ("Sabotage of Border Delimitation Talks", "Our delegates intentionally walked out of border negotiations to heighten military tensions.", "rare"),
        ("Unauthorized Diplomatic Recognition", "An rogue consul issued official credentials recognizing a breakaway territory.", "rare"),
        ("Foreign Ministry Resistance to Sanctions", "Ministry staff secretly helped designated foreign entities bypass executive sanctions.", "rare"),
        ("Espionage Ring Operating in Chancery", "A counter-intelligence sweep finds foreign listening devices installed by our own embassy staff.", "rare"),
        ("Hostile Coalition Secret Treaty", "The foreign minister secretly negotiated accession to a hostile economic bloc behind cabinet's back.", "epic"),
        ("Sovereign Territory Concession Deal", "Envoys signed a secret protocol ceding maritime economic zones to a foreign rival.", "epic"),
        ("Compromised Diplomatic Cryptocipher", "The master cryptographic codes used for all diplomatic communications were sold to adversaries.", "epic"),
        ("Foreign Interference Orchestration", "Ministry insiders helped foreign intelligence finance domestic opposition groups.", "epic"),
        ("Betrayal of Allied Government Secrets", "Our diplomats leaked confidential operational intelligence shared by our closest treaty ally.", "epic"),
        ("Treasonous Treaty of Submission", "The foreign minister drafted an unauthorized capitulation accord yielding sovereignty to a rival empire.", "legendary"),
        ("Total Diplomatic Service Revolt", "The diplomatic corps coordinated with foreign governments to impose international sanctions on our nation.", "legendary"),
    ],
    ('foreign', 'improvement'): [
        ("Successful Bilateral Trade Protocol", "Trade negotiators secure tariff reductions for our primary manufactured exports.", "common"),
        ("Consular Efficiency Milestone", "Streamlining overseas visa processing boosts business travel and tourism revenue.", "common"),
        ("Cultural Diplomacy Triumph", "A touring national arts exhibition wins widespread positive media coverage in partner nations.", "common"),
        ("Peaceful Fishery Accord", "A contentious maritime fishing dispute is peacefully resolved through constructive dialogue.", "common"),
        ("Expatriate Investment Summit", "A successful conference encourages the national diaspora to invest heavily in domestic bonds.", "common"),
        ("Bilateral Visa-Free Travel Pact", "Reciprocal visa-free travel is established with a stable neighboring trading partner.", "common"),
        ("Border Post Modernization", "Smooth processing at international road and rail crossings accelerates commercial transit.", "common"),
        ("Hostage Release Resolution", "Quiet consular diplomacy secures the peaceful release of citizens detained abroad.", "common"),
        ("Regional Environmental Cooperation", "Neighboring states agree to joint river basin management and flood prevention protocols.", "common"),
        ("Commendation from International Observers", "Foreign diplomatic missions formally praise the professionalism of our border protocol.", "common"),
        ("Strategic Bilateral Trade Breakthrough", "A sweeping free trade agreement opens major foreign markets to our raw commodities.", "rare"),
        ("Peace Summit Triumph in Capital", "Our foreign ministry successfully hosts and mediates a historic peace accord between rivals.", "rare"),
        ("Foreign Direct Investment Wave", "Diplomatic roadshows secure billions in capital commitments from major overseas conglomerates.", "rare"),
        ("Diplomatic De-escalation Victory", "Skilled negotiation defuses an imminent military confrontation along a contested border.", "rare"),
        ("Extradition Treaty Ratification", "New treaties allow the repatriation of fugitive corrupt financiers and their stolen assets.", "rare"),
        ("Regional Trade Corridor Pact", "Our nation is chosen as the central transit hub for a major international rail network.", "rare"),
        ("Diplomatic Prestige Recognition", "Our chief diplomat is unanimously elected to chair a key international governance forum.", "rare"),
        ("Favorable Border Demarcation Accord", "A permanent border treaty secures strategic highland passes and water rights permanently.", "rare"),
        ("Historic Non-Aggression Pact", "A comprehensive mutual security pact with former adversaries eliminates regional invasion risk.", "epic"),
        ("Global Economic Alliance Leadership", "Our nation takes the presidency of a dominant global trade and resource bloc.", "epic"),
        ("International Arbitration Victory", "An international tribunal rules fully in our favor, granting vast offshore mineral reserves.", "epic"),
        ("Transformative Regional Integration Accord", "A sweeping economic union agreement unlocks frictionless trade across the entire continent.", "epic"),
        ("Universal Diplomatic Normalization", "Every major power officially signs strategic partnership accords with our government.", "epic"),
        ("The Grand Continental Peace Treaty", "Our diplomats engineer a landmark continental treaty that outlaws aggressive war forever.", "legendary"),
        ("Hegemonic Diplomatic Primacy", "Our nation's foreign ministry becomes the unchallenged supreme arbiter of global geopolitics.", "legendary"),
    ],
    ('foreign', 'upgrade'): [
        ("Chancery Communications Modernization", "Upgrading embassy telecom lines enables high-definition encrypted diplomatic video summits.", "common"),
        ("Diplomatic Corps Language Training", "Comprehensive linguistic programs enhance diplomatic effectiveness in key emerging markets.", "common"),
        ("Automated Consular Visa System", "Deploying biometric kiosks speeds visa issuance and eliminates document falsification.", "common"),
        ("Commercial Attache Expansion", "Stationing trade specialists in key foreign industrial centers boosts export contract wins.", "common"),
        ("Bilateral Protocol Digital Database", "A searchable digital registry organizes all bilateral treaties and historical agreements.", "common"),
        ("International Law Research Bureau", "A specialized legal team strengthens our defense in international commercial disputes.", "common"),
        ("Public Diplomacy Media Studio", "State broadcasting expands multi-language broadcasts to project national culture abroad.", "common"),
        ("Crisis Evacuation Taskforce", "Specialized diplomatic security teams are trained to coordinate rapid personnel extraction.", "common"),
        ("Expatriate Citizen Registry App", "A digital portal allows immediate communication with citizens living or traveling overseas.", "common"),
        ("Chancery Physical Security Reinforcement", "Embassies in volatile regions receive perimeter hardening and ballistic surveillance.", "common"),
        ("Global Diplomatic Intelligence Network", "Specialized diplomatic attaches provide actionable geopolitical intelligence directly to cabinet.", "rare"),
        ("Secure Diplomatic Satellite Constellation", "Dedicated military-grade satellite channels protect all overseas diplomatic traffic.", "rare"),
        ("International Arbitration Complex", "A world-class tribunal center in our capital attracts international corporate litigation.", "rare"),
        ("Diplomatic Academy Overhaul", "An elite foreign service academy trains the next generation of master negotiators.", "rare"),
        ("Bilateral Trade Modeling Engine", "Sophisticated economic simulation software predicts tariff impacts before negotiations begin.", "rare"),
        ("Consular Emergency Rapid-Deployment Team", "Mobile consular squads can deploy to global disaster zones within twelve hours.", "rare"),
        ("Strategic Cultural Centers Network", "Opening cultural institutes in major world capitals builds enduring geopolitical goodwill.", "rare"),
        ("Automated Treaty Compliance Monitor", "Software alerts cabinet whenever foreign partners breach agreed-upon trade or environmental terms.", "rare"),
        ("Global Economic Diplomacy Command", "An integrated headquarters coordinates foreign aid, trade deals, and sovereign loans globally.", "epic"),
        ("Quantum-Encrypted Diplomatic Trunkline", "Unbreakable quantum cryptography shields all communications with our global embassy network.", "epic"),
        ("Artificial Intelligence Geopolitical Predictor", "Machine intelligence forecasts diplomatic shifts and foreign unrest months before they occur.", "epic"),
        ("Sovereign Multilateral Summit Complex", "A monumental headquarters hosts permanent international summits and world summits.", "epic"),
        ("Global Media and Soft-Power Network", "Our global multilingual news network rivals the premier broadcast services in world influence.", "epic"),
        ("Worldwide Diplomatic Dominance Matrix", "An omnipresent diplomatic network positions our envoys at the center of every global decision.", "legendary"),
        ("Unified Global Peacekeeping Command", "Our foreign ministry commands an international peacekeeping framework that enforces world order.", "legendary"),
    ],

    ('defense', 'corruption'): [
        ("Ghost Soldier Payroll", "Auditors uncover thousands of non-existent soldiers whose pay was drawn by senior commanders.", "common"),
        ("Inflated Munitions Procurement", "A defense supplier charged triple market price for basic artillery shells with kickbacks to generals.", "common"),
        ("Military Fuel Black Market", "Thousands of tons of aviation fuel and diesel were systematically siphoned to private gas stations.", "common"),
        ("Barracks Construction Subcontract Fraud", "Substandard concrete was used for new garrison barracks while funds were pocketed by contractors.", "common"),
        ("Bribery for Officer Promotion", "Commissioned rank advancements were systematically traded for cash rather than merit or combat skill.", "common"),
        ("Scrap Metal Armor Scam", "Decommissioned armored vehicles were reported destroyed but sold to foreign warlords for parts.", "common"),
        ("Ration Quality Downgrade", "Troop combat rations were diluted with inferior expired foodstuffs to pocket the supply difference.", "common"),
        ("Unauthorized Base Land Leases", "Military reservation land was secretly leased to commercial developers for private golf resorts.", "common"),
        ("Maintenance Logging Falsification", "Aircraft and tanks were certified combat-ready on paper despite missing engines and spare parts.", "common"),
        ("Weapons Depot Inventory Theft", "Rifles, sidearms, and night-vision gear disappeared from armories into civilian black markets.", "common"),
        ("Substandard Body Armor Kickbacks", "Troops were deployed with ceramic plates that fail ballistic tests after a kickback deal.", "rare"),
        ("Warship Drydock Overbilling", "Naval overhauls were billed at astronomical rates for routine cleaning and paint jobs.", "rare"),
        ("Secret Arms Sale to Embargoed State", "Surplus missile components were covertly shipped to an internationally sanctioned dictatorship.", "rare"),
        ("General Staff Luxury Aviation", "Combat transport aircraft were lavishly refitted as VIP jets for senior general staff holidays.", "rare"),
        ("Defense R&D Phantom Projects", "Millions allocated for laser guidance research were funneled into unverified shell companies.", "rare"),
        ("Military Medical Supply Diversion", "Morphine and surgical gear intended for field hospitals were sold to private pharmacies.", "rare"),
        ("Draft Exemption Bribery Racket", "Wealthy families paid military physicians to grant fraudulent medical draft exemptions.", "rare"),
        ("Classified Arsenal Scrap Thefts", "Decommissioned heavy artillery barrels were melted down and sold as commercial steel.", "rare"),
        ("Air Defense Radar Embezzlement", "Critical radar installations were left non-operational because funds for vacuum tubes were embezzled.", "epic"),
        ("General Staff Secret Syndicate", "A junta of senior admirals and generals owned private logistics companies billing the state billions.", "epic"),
        ("Selling Armored Division Heavy Armor", "Modern main battle tanks were stripped of reactive armor modules for sale to foreign syndicates.", "epic"),
        ("Strategic Munitions Depot Heist", "An entire underground bunker of precision cruise missiles was hollowed out by corrupt custodians.", "epic"),
        ("Defense Minister Bribe Megascandal", "Wiretaps reveal the defense minister accepted hundreds of millions to approve defective jet fighters.", "epic"),
        ("Strategic Nuclear Fuel Embezzlement", "Enriched nuclear fuel rods were diverted from military reactors for sale on the atomic black market.", "legendary"),
        ("Total Armed Forces Procurement Capture", "The defense establishment was completely subordinated to a transnational criminal cartel.", "legendary"),
    ],
    ('defense', 'betrayal'): [
        ("Leaked Base Coordinates", "Detailed satellite coordinates of underground command bunkers were leaked to foreign intelligence.", "common"),
        ("Garrison Mutiny Whispers", "Underpaid soldiers in a northern frontier base hold unauthorized meetings demanding back pay.", "common"),
        ("Unauthorized Troop Movement", "A brigade commander moved mechanized units toward the capital without general staff clearance.", "common"),
        ("Military Cipher Compromise", "A tactical communications codebook was lost or stolen from a frontline signals battalion.", "common"),
        ("Officer Defection to Foreign Military", "A flight lieutenant flew an advanced trainer jet across the border to claim foreign asylum.", "common"),
        ("Sabotage of Munitions Depot", "An explosion at a secondary ammunition storage site points to deliberate internal sabotage.", "common"),
        ("Defense Intelligence Memo Leak", "Classified war games analysis showing vulnerabilities in our coastal defense appears in print.", "common"),
        ("Unauthorized Warship Patrol", "A naval frigate entered contested waters against direct standing orders, sparking an incident.", "common"),
        ("Anti-War Pamphleteering in Ranks", "Subversive anti-conscription literature was distributed inside military training camps.", "common"),
        ("Armory Lockout Incident", "A rogue logistics unit locked out inspectors attempting to verify heavy weapon inventories.", "common"),
        ("Selling Defense Blueprints", "Engineers from the state ordnance bureau sold missile engine schematics to a rival power.", "rare"),
        ("Frontline Unit Insubordination", "A division commander refused direct operational deployment orders citing safety concerns.", "rare"),
        ("Air Defense Network Sabotage", "Software patches uploaded to our early-warning radars created permanent radar blind spots.", "rare"),
        ("Military Coup Plot Exposure", "A cell of mid-ranking colonels was caught planning to arrest the civilian defense leadership.", "rare"),
        ("Leaking War Contingency Plans", "The complete operational invasion and counter-offensive battle plan was handed to adversaries.", "rare"),
        ("Naval Commander Secret Defection", "A submarine captain rendezvoused with a foreign vessel to deliver sensitive sonar recordings.", "rare"),
        ("Defense Minister Defiance", "The defense minister publicly contradicts the head of state on national television regarding military readiness.", "rare"),
        ("Troop Sabotage of Combat Vehicles", "Dissident mechanics intentionally cut hydraulic brake lines on frontline armored carriers.", "rare"),
        ("Armed Garrison Coup Ultimatum", "The elite capital defense brigade mobilizes in battle dress and issues political ultimatums to cabinet.", "epic"),
        ("Hostile Invasion Path Treason", "A regional commander agreed to stand down coastal defense batteries in the event of an attack.", "epic"),
        ("Master Military Cryptographic Breach", "Adversaries obtain the master encryption algorithms securing all national tactical communications.", "epic"),
        ("Strategic Bomber Defection Conspiracy", "A squadron of strategic bombers was prepared to defect to a hostile coalition during war games.", "epic"),
        ("General Staff Junta Formation", "The highest tier of military commanders signs a secret pact to seize executive power during crises.", "epic"),
        ("Nuclear Command Protocol Treason", "A treasonous faction within strategic forces attempted to override permissive action links on nuclear weapons.", "legendary"),
        ("Full Military Insurrection and Civil War Threat", "The entire armed forces leadership moves to overthrow the constitution and establish military rule.", "legendary"),
    ],
    ('defense', 'improvement'): [
        ("Combined Arms Training Success", "Joint infantry and armor exercises demonstrate superior tactical speed and coordination.", "common"),
        ("Recruit Marksmanship Milestone", "A reformed infantry training syllabus raises marksmanship and battlefield discipline scores.", "common"),
        ("Expedited Maintenance Turnaround", "Mechanized division mechanics clear backlogged repairs ahead of operational schedules.", "common"),
        ("Naval Gunnery Accuracy Commendation", "Fleet exercises achieve record hit rates during live-fire surface bombardment drills.", "common"),
        ("Border Patrol Interception Triumph", "Vigilant border guards intercept an armed infiltration squad attempting to cross into national territory.", "common"),
        ("Military Engineer Infrastructure Feat", "Army combat engineers rapidly construct bridges restoring vital civilian and supply transit.", "common"),
        ("High Troop Re-enlistment Surge", "Improved barracks conditions and morale result in exceptional retention among veteran sergeants.", "common"),
        ("Aviation Safety Award", "Air defense wings complete an entire operational cycle with zero training accidents or airframe losses.", "common"),
        ("Domestic Munitions Self-Sufficiency", "State arsenals meet full quarterly domestic demand for small arms ammunition and artillery shells.", "common"),
        ("Special Operations Infiltration Win", "An elite commando unit successfully completes a sensitive clandestine reconnaissance mission.", "common"),
        ("Breakthrough Tactical Doctrine", "A new operational doctrine drastically reduces expected battlefield casualties in mobile defense.", "rare"),
        ("Indigenous Armor Upgrade Package", "Domestic engineers develop explosive reactive armor tiles that double tank survivability.", "rare"),
        ("Naval Fleet Sea Trial Excellence", "New guided-missile corvettes complete rigorous open-ocean trials ahead of delivery schedule.", "rare"),
        ("Air Superiority Readiness Surge", "Intensive pilot dogfight training achieves air superiority ratings matching premier world air forces.", "rare"),
        ("Strategic Logistics Speed Record", "A surprise national mobilization drill deploys two full divisions to border garrisons in 24 hours.", "rare"),
        ("Counter-Battery Artillery Triumph", "Automated acoustic counter-battery systems allow instant neutralization of opposing fire.", "rare"),
        ("Domestic Fighter Jet Overhaul", "Our air force refits aging interceptors with modern avionics, extending service life by a decade.", "rare"),
        ("Elite Command Integration", "Streamlining the chain of command cuts tactical decision latency from hours to seconds.", "rare"),
        ("Dominant Integrated Defense Grid", "Our interlocking radar, missile, and mechanized forces establish total regional deterrence.", "epic"),
        ("Historic Military Modernization Triumph", "A multi-year transformation elevates our military to the most formidable fighting force in the region.", "epic"),
        ("Strategic Deterrence Supremacy", "Our long-range strike systems achieve guaranteed retaliatory capability, ending invasion threats.", "epic"),
        ("Total Maritime Dominance Achieved", "The national navy secures complete control of strategic sea lanes and offshore economic zones.", "epic"),
        ("Flawless National Defense Readiness", "Every military branch achieves peak operational readiness with zero equipment defects.", "epic"),
        ("The Supreme Armed Forces Ascendancy", "Our armed forces become an invincible, perfectly disciplined instrument of national power and sovereignty.", "legendary"),
        ("Invulnerable Sovereign Fortress", "The homeland is transformed into an impenetrable bastion that no world empire dares challenge.", "legendary"),
    ],
    ('defense', 'upgrade'): [
        ("Modernized Tactical Radios", "Equipping combat platoons with frequency-hopping tactical radios stops enemy jamming.", "common"),
        ("Night Vision Goggles Deployment", "Issuing modern thermal and night optics gives frontline infantry 24-hour combat capability.", "common"),
        ("Armored Logistics Carrier Fleet", "Procuring heavy all-terrain supply trucks ensures continuous fuel and ammo delivery to frontlines.", "common"),
        ("Air Base Hardened Shelters", "Constructing reinforced concrete aircraft shelters protects fighter jets from missile strikes.", "common"),
        ("Naval Sonar Grid Expansion", "Deploying seabed acoustic sensor arrays detects unauthorized foreign submarine intrusions.", "common"),
        ("Mobile Counter-Drone Jammers", "Equipping vehicle columns with portable electronic jammers neutralizes commercial drone threats.", "common"),
        ("Automated Munitions Assembly Line", "Modernizing artillery shell factories doubles production output while cutting defect rates.", "common"),
        ("Combat Field Medical Stations", "Deploying motorized surgical trauma units improves battlefield survival rates drastically.", "common"),
        ("Precision Artillery Guidance Kits", "Adding GPS guidance kits converts conventional artillery rounds into precision-guided munitions.", "common"),
        ("Military Physical Training Centers", "Modern athletic complexes improve recruit physical conditioning and reduce training injuries.", "common"),
        ("C4ISR Integrated Command Network", "A computerized battlefield management system connects infantry, armor, and air support in real time.", "rare"),
        ("Unmanned Aerial Reconnaissance Fleet", "Deploying medium-altitude surveillance drones provides persistent 24/7 border monitoring.", "rare"),
        ("Active Protection Systems for Armor", "Installing hard-kill interceptor rockets on main battle tanks defeats incoming anti-tank missiles.", "rare"),
        ("Long-Range Early Warning Radar", "A giant phased-array radar station tracks airborne targets hundreds of kilometers beyond our borders.", "rare"),
        ("Hypersonic Coastal Defense Batteries", "Stationing mobile supersonic anti-ship missiles seals coastal approaches against hostile fleets.", "rare"),
        ("Subterranean Command Citadel", "A hardened command center buried deep inside granite mountains ensures military continuity.", "rare"),
        ("Electronic Warfare Dominance Suite", "High-power ground jammers can blind enemy radar and communications across entire battlefronts.", "rare"),
        ("Air Defense Layered Interceptor Network", "Integrating short, medium, and long-range surface-to-air missiles creates an iron umbrella.", "rare"),
        ("Space-Based Military Reconnaissance", "Launching dedicated military observation satellites provides real-time global target tracking.", "epic"),
        ("Autonomous Drone Swarm Architecture", "Coordinated AI drone swarms can overwhelm opposing air defenses and armor formations.", "epic"),
        ("Next-Generation Stealth Air Dominance", "Deploying advanced stealth multi-role strike aircraft ensures unchallenged deep strike capability.", "epic"),
        ("Directed-Energy Air Defense Cannons", "High-energy laser batteries provide instantaneous, low-cost interception of incoming rockets.", "epic"),
        ("Strategic Multi-Tier Missile Shield", "An advanced exo-atmospheric interceptor shield protects major cities from ballistic strikes.", "epic"),
        ("Autonomous AI Battle Management Superintelligence", "A neural battle management network processes millions of sensor inputs and directs combat with machine speed.", "legendary"),
        ("Global Orbital Defense Grid", "An unbreachable orbital and aerospace defense shield guarantees eternal sovereignty.", "legendary"),
    ],

    ('industry', 'corruption'): [
        ("Illegal Mining Concessions", "Inspectors discover unrecorded mining shafts operating with forged ministry permits.", "common"),
        ("Refinery Environmental Kickbacks", "Toxic industrial effluent was dumped into rivers after inspectors accepted cash envelopes.", "common"),
        ("Falsified Mineral Assay Certificates", "Export ore grades were systematically falsified to pocket high-purity price premiums.", "common"),
        ("Factory Safety Inspection Bribery", "Dangerous factory equipment was signed off as compliant without physical inspections.", "common"),
        ("Strategic Machinery Subsidy Fraud", "Industrial subsidies for advanced tool tooling were funneled into shell companies.", "common"),
        ("Rare Earth Mineral Smuggling", "Critical minerals were mislabeled as ordinary gravel to bypass strategic export controls.", "common"),
        ("State Smelter Energy Thefts", "Private smelting operations illegally tapped high-voltage lines from state hydro dams.", "common"),
        ("Industrial Equipment Kickback Ring", "Outdated European refinery machinery was purchased at brand-new prices with kickbacks.", "common"),
        ("Phantom Geothermal Prospecting", "Drilling contracts for geothermal energy were awarded to companies that never broke ground.", "common"),
        ("Timber Extraction Over-Logging", "Timber conglomerates logged deep into protected national reserves under cover of ministry permits.", "common"),
        ("Secret State Mine Privatization", "Valuable lithium and copper concessions were quietly transferred to the minister's cronies.", "rare"),
        ("Strategic Reserve Stockpile Siphoning", "Bunkers of emergency copper and oil reserves were sold off to meet private trading debts.", "rare"),
        ("Industrial Espionage Bribes", "Ministry engineers accepted foreign bribes to share proprietary industrial alloy formulations.", "rare"),
        ("Monopoly Smelting Cartel Protection", "The ministry actively suppressed independent smelters to preserve a favored conglomerate's monopoly.", "rare"),
        ("Fictitious Factory Employment Grants", "State grants for hiring thousands of manufacturing apprentices were pocketed by factory owners.", "rare"),
        ("Chemical Safety Cover-Up", "Catastrophic pesticide storage leaks were buried by ministry officials to protect factory owners.", "rare"),
        ("Offshore Mining Concession Shells", "Billion-dollar mineral exploration licenses were granted to zero-employee offshore entities.", "rare"),
        ("Industrial Water Allocation Bribery", "Agricultural and urban water supplies were diverted to private factories during drought.", "rare"),
        ("National Petroleum Extraction Siphon", "Pipeline monitoring software was calibrated to skim a percentage of daily crude output.", "epic"),
        ("Strategic Uranium Divergence Racket", "Discrepancies in uranium ore accounting point to covert sales outside international safeguards.", "epic"),
        ("Mega-Industrial Plant Kickback Scheme", "A billion-dollar state petrochemical complex was built with defective steel to pocket funds.", "epic"),
        ("Industrial Ministry Gold Hoard", "A raided warehouse reveals tons of unregistered raw gold ingots stamped with ministry seals.", "epic"),
        ("Total Resource Concession Capture", "Every strategic extraction concession in the country was locked in 99-year corrupt sweetheart deals.", "epic"),
        ("The Grand Industrial Resource Kleptocracy", "The entire top leadership of the industry ministry ran a multi-billion-dollar global mineral trafficking cartel.", "legendary"),
        ("Total Subversion of National Industrial Policy", "National industrial strategy was entirely rewritten to enrich a foreign state-owned mining titan.", "legendary"),
    ],
    ('industry', 'betrayal'): [
        ("Leaked Industrial Patent Blueprints", "Proprietary blueprints for state-funded energy turbines were leaked to foreign manufacturers.", "common"),
        ("Sabotage of Power Substation", "Deliberate tampering at a critical industrial grid hub shuts down smelting operations.", "common"),
        ("Secret Mineral Export Deals", "A director signed unauthorized commitments shipping strategic metals to a rival nation.", "common"),
        ("Intentional Refinery Shutdown", "Maintenance managers staged an artificial breakdown to force emergency imports from a private cartel.", "common"),
        ("Industrial Union Agitation Incitement", "Ministry liaisons secretly encouraged wildcat strikes in state factories to demand higher budgets.", "common"),
        ("Leak of Strategic Reserve Deficits", "Confidential memos showing that fuel reserves are near empty were published by opposition media.", "common"),
        ("Unauthorized Factory Decommissioning", "A functioning state textile plant was abruptly sold for scrap without cabinet authorization.", "common"),
        ("Whistleblower Reveals Safety Hazards", "A disgruntled safety inspector holds a press conference detailing systemic refinery fires.", "common"),
        ("Industrial Software Source Code Stolen", "Proprietary software coordinating national rail supply lines was downloaded onto unverified drives.", "common"),
        ("Mining License Duplication Chaos", "A corrupt registrar issued conflicting extraction rights to rival armed corporate factions.", "common"),
        ("Industrial Espionage Ring in R&D", "Foreign corporate moles were caught copying advanced metallurgical research data.", "rare"),
        ("Hostile Corporate Takeover Assistance", "Ministry officials secretly helped a foreign conglomerate orchestrate a hostile buyout of national steel.", "rare"),
        ("Sabotage of Strategic Pipeline", "A valve manipulation incident on the main crude pipeline halts refinery inputs for days.", "rare"),
        ("Rival Nation Rare Earth Accord", "A senior official promised exclusive rare earth rights to an adversarial state behind cabinet's back.", "rare"),
        ("Industrial Ministry Resistance to Green Transition", "Officials systematically obstructed cabinet directives to modernize aging thermal plants.", "rare"),
        ("Concealing Major Mineral Depletion", "Geologists hid data proving that the nation's premier iron mine is nearly exhausted.", "rare"),
        ("Defection of Chief Metallurgist", "The head of national materials research defects to an international competitor with secret formulas.", "rare"),
        ("Unauthorized Technology Licensing", "Exclusive rights to state-funded synthetic fuel catalysts were granted to a foreign firm.", "rare"),
        ("Grid Blackout Conspiracy", "A cabal of energy directors conspired to cause rolling blackouts to pressure cabinet into tariff cuts.", "epic"),
        ("Sabotage of National Nuclear Plant", "Deliberate tampering with control rod telemetry shuts down the nation's premier atomic reactor.", "epic"),
        ("Handing Over Strategic Supply Chains", "The industry ministry signed agreements making national manufacturing totally dependent on rival imports.", "epic"),
        ("Theft of Next-Gen Semiconductor Masks", "Photolithography masks for experimental domestic microchips were exfiltrated abroad.", "epic"),
        ("Comprehensive Industrial Treason Accord", "The minister of industry secretly signed treaties ceding management of national factories to foreign cartels.", "epic"),
        ("Total Destruction of Strategic Refining Capacity", "A coordinated sabotage plot destroys primary catalytic cracking units across all state refineries.", "legendary"),
        ("Industrial Coup and Resource Secession", "Industrial bosses and rogue mining directors declare autonomy over the nation's richest mineral province.", "legendary"),
    ],
    ('industry', 'improvement'): [
        ("Lean Manufacturing Efficiency Surge", "Adopting modern workflow optimization boosts factory throughput with zero extra capital.", "common"),
        ("Streamlined Prospecting Permitting", "Consolidating environmental paperwork speeds mineral survey approvals for legitimate firms.", "common"),
        ("Factory Safety Record Milestone", "Heavy industrial plants complete a year without major operational accidents or downtime.", "common"),
        ("Energy Efficiency Retrofit Win", "Replacing aging industrial boilers cuts industrial electricity consumption significantly.", "common"),
        ("Machine Tool Modernization", "Upgraded computer numerical control equipment enhances component precision and output.", "common"),
        ("Scrap Metal Recycling Surge", "Collecting and remelting industrial scrap supplies steel mills at a fraction of iron ore costs.", "common"),
        ("Apprenticeship Program Enrollment", "Thousands of young workers graduate from technical trades programs, filling factory shifts.", "common"),
        ("Water Recycling in Smelters", "Closed-loop water filtration enables continuous metal smelting even during dry seasons.", "common"),
        ("Predictive Maintenance Scheduling", "Vibration sensors catch machine wear before breakdowns occur, preventing assembly shutdowns.", "common"),
        ("Quality Assurance Defect Drop", "Rigorous factory testing slashes component rejection rates in manufactured export goods.", "common"),
        ("Major New Mineral Vein Discovered", "Seismic prospecting locates a massive underground copper and lithium deposit.", "rare"),
        ("Record Refining Throughput Milestone", "State refineries achieve record daily processing volumes, leaving strategic stockpiles overflowing.", "rare"),
        ("Advanced Metallurgy Alloy Breakthrough", "Domestic laboratories invent a lightweight steel alloy with extreme tensile strength.", "rare"),
        ("Industrial Energy Autonomy Breakthrough", "Co-generation turbines harness factory waste heat to produce cheap supplemental power.", "rare"),
        ("Automated Conveyor Logistics Hub", "A modernized rail-to-port bulk freight depot halves the transit time for raw mineral exports.", "rare"),
        ("Deep Borehole Geothermal Success", "Deep exploratory wells strike high-temperature geothermal steam, providing cheap baseload power.", "rare"),
        ("Industrial Cluster Synergies", "Co-locating chemical refineries and plastics manufacturers cuts raw material freight overhead.", "rare"),
        ("Domestic Machine Tool Self-Sufficiency", "Our factories begin producing their own precision lathes, ending reliance on costly imports.", "rare"),
        ("Total Strategic Resource Self-Reliance", "Domestic extraction fully satisfies national industrial consumption for all key commodities.", "epic"),
        ("National Industrial Renaissance Landmark", "Our manufacturing sector leads the world in efficiency, quality, and technological sophistication.", "epic"),
        ("Pioneering Clean Refining Technology", "A revolutionary chemical extraction process doubles metal yield while emitting zero toxic waste.", "epic"),
        ("Unrivaled Strategic Mineral Reserves", "Newly verified national mineral reserves place our nation among the top resource powers on Earth.", "epic"),
        ("Integrated High-Tech Manufacturing Ecosystem", "From raw ore to advanced microchips, every step of the industrial chain operates within our borders.", "epic"),
        ("The Supreme Industrial Era", "Our nation's industrial output powers a golden age of limitless wealth and technological dominance.", "legendary"),
        ("The Fully Automated National Workshop", "A self-sustaining, carbon-negative, robotic industrial apparatus manufactures infinite prosperity.", "legendary"),
    ],
    ('industry', 'upgrade'): [
        ("Seismic Exploration Rig Deployment", "Acquiring advanced 3D seismic survey trucks speeds the discovery of hidden mineral deposits.", "common"),
        ("Automated Quarry Drilling Systems", "Deploying automated drilling rigs increases open-pit mineral extraction speed.", "common"),
        ("High-Efficiency Centrifugal Flotation", "Installing modern flotation cells recovers more copper and zinc from low-grade ores.", "common"),
        ("Computerized Warehouse Inventory", "Radio-frequency tracking manages parts and raw material stocks across national depots.", "common"),
        ("Industrial Pollution Scrubbers", "Fitting electrostatic scrubbers on smokestacks cuts harmful emissions while capturing sulfur.", "common"),
        ("High-Capacity Slurry Pipelines", "Piping crushed ore directly to refineries in water slurry eliminates costly road freight.", "common"),
        ("Heavy Industrial Crane Modernization", "Upgrading port and rail gantry cranes speeds container and bulk freight transshipment.", "common"),
        ("Modular Substation Grid Ties", "Deploying modular electric substations rapidly connects new extraction sites to national power.", "common"),
        ("Precision Metal Stamping Presses", "High-tonnage hydraulic presses improve automotive and defense stamping tolerances.", "common"),
        ("Worker Ergonomics and Exoskeletons", "Deploying pneumatic lifting assists reduces worker fatigue and boosts physical factory output.", "common"),
        ("Robotic Assembly Line Integration", "Industrial robotic arms take over precision welding and assembly across state manufacturing.", "rare"),
        ("Catalytic Cracking Unit Upgrade", "Modernizing refinery cracking towers yields significantly higher fractions of aviation fuel and diesel.", "rare"),
        ("Rare Earth Extraction Centrifuges", "Advanced chemical centrifuges allow domestic separation of high-purity battery-grade rare earths.", "rare"),
        ("Supercomputing Mineral Modeling Suite", "A state supercomputer generates 3D geological simulations pinpointing deep subterranean ore bodies.", "rare"),
        ("Autonomous Haulage Truck Fleet", "Driverless mining trucks operate around the clock in open-pit mines with zero driver downtime.", "rare"),
        ("High-Temperature Electric Arc Furnaces", "Electric arc furnaces recycle scrap steel using renewable hydro power rather than imported coking coal.", "rare"),
        ("Synthetic Fuel Pilot Plant", "A coal-to-liquids and biomass synthesis facility provides strategic insurance against oil blockades.", "rare"),
        ("Smart Grid Industrial Load Balancing", "AI software dynamically balances factory power demands to maximize grid stability.", "rare"),
        ("Advanced Semiconductor Fabrication Facility", "Constructing a domestic silicon wafer fabrication foundry establishes microchip sovereignty.", "epic"),
        ("Autonomous Deep-Shaft Robotic Mining", "Robotic drills extract ore from depths too hot and hazardous for human miners.", "epic"),
        ("Plasma Arc Gasification Complex", "Plasma gasification plants convert industrial and municipal waste into clean synthetic gas.", "epic"),
        ("Superconducting Power Grid Transmission", "Zero-loss high-voltage superconducting cables connect remote generation dams directly to factories.", "epic"),
        ("National Molecular Manufacturing Center", "Nanotechnology synthesis laboratories begin producing ultra-durable carbon-nanotube structural materials.", "epic"),
        ("Orbital Solar Power Beaming Receiver", "Space-based solar collector arrays beam continuous megawatts directly into national industrial hubs.", "legendary"),
        ("Self-Replicating Automated Industrial Matrix", "An interconnected web of automated factories, mines, and refineries operates with zero human labor.", "legendary"),
    ],

    ('interior', 'corruption'): [
        ("Police Protection Racket", "Business owners in the capital report regular extortion visits from uniformed police inspectors.", "common"),
        ("Customs Border Smuggling Ring", "Border police accepted cash to look away while untaxed goods crossed checkpoint lanes.", "common"),
        ("Civil Registry Identity Forgery", "Clerks in the national identity bureau sold genuine passports to international fugitives.", "common"),
        ("Prison Labor Kickback Scheme", "Penitentiary wardens rented inmate labor to private farms while pocketing state stipends.", "common"),
        ("Bribes for Concealed Carry Permits", "Firearm licenses were issued to violent felons who paid intermediaries in the interior ministry.", "common"),
        ("Impound Lot Vehicle Resale", "Seized luxury cars mysteriously vanished from police impound lots into private garages.", "common"),
        ("Traffic Enforcement Ticket Quotas", "Traffic police targeted commercial delivery vans with trumped-up fines to fund division bonuses.", "common"),
        ("Court Evidence Tampering", "Physical evidence lockers were compromised, causing drug and corruption trials to collapse.", "common"),
        ("Discretionary Riot Gear Spending", "The interior ministry ordered luxury SUVs and unmarked sports cars under riot suppression codes.", "common"),
        ("Gambling Den Protection Payoffs", "Illegal underground casinos operated openly under the protection of district police chiefs.", "common"),
        ("Cartel Extortion in Gendarmerie", "A high-ranking gendarmerie commander was on a monthly retainer from organized crime cartels.", "rare"),
        ("Selling Classified Informant Dossiers", "Undercover agent rosters were sold to criminal organizations, leading to deadly assassinations.", "rare"),
        ("Covert Surveillance of Political Rivals", "Interior intelligence units were caught bugging the homes and phones of opposition lawmakers.", "rare"),
        ("Asset Forfeiture Siphoning", "Millions in confiscated cash from cartel busts were funneled into private ministry accounts.", "rare"),
        ("Falsified Crime Statistics", "Police precincts systematically downgraded felony reports to misdemeanors to fake a drop in crime.", "rare"),
        ("Extortion of Migrant Workers", "Interior enforcement squads harassed foreign laborers to extract weekly cash payments.", "rare"),
        ("Bribes for Parole Approvals", "A corrupt judicial board within the interior ministry traded early releases for cash bribes.", "rare"),
        ("Illegal Wiretapping Equipment Diversion", "Military-grade phone surveillance hardware was loaned out to private corporate investigators.", "rare"),
        ("Organized Crime Syndicate at Ministry Top", "A sprawling mafia network had its own executives appointed as deputy interior ministers.", "epic"),
        ("National Police Slush Fund Laundromat", "Unmonitored special operations bank accounts were used to finance overseas luxury properties.", "epic"),
        ("Staging Fake Riots for Budget Increases", "Provocateurs were paid by police chiefs to incite violence and justify emergency budget boosts.", "epic"),
        ("Selling State Secrets to Criminal Cartels", "Confidential raids and wiretap schedules were leaked directly to cartel bosses.", "epic"),
        ("Interior Minister Mansion Raid", "Anti-graft officers uncover vault rooms full of cartel cash and diamonds inside the minister's home.", "epic"),
        ("Total Police State Criminal Capture", "The national law enforcement apparatus was transformed into an armed enforcement arm for oligarchs.", "legendary"),
        ("The Grand Sovereign Protection Syndicate", "The entire internal security apparatus ran an extortion monopoly taxing every sector of the economy.", "legendary"),
    ],
    ('interior', 'betrayal'): [
        ("Leaked Informant Roster", "Names and addresses of protected police informants were uploaded to the public internet.", "common"),
        ("Unauthorized Police Strike Threat", "Police unions threaten to walk off beats nationwide unless cabinet grants complete legal immunity.", "common"),
        ("Sabotage of Emergency 911 Grid", "A deliberate software misconfiguration delays emergency dispatch responses during protests.", "common"),
        ("Internal Security Memo Leak", "Confidential memos warning that urban unrest could overwhelm police were leaked to the press.", "common"),
        ("Disobedience on Eviction Orders", "Regional police units refuse to enforce lawful judicial orders to clear illegally seized land.", "common"),
        ("Unauthorized Surveillance of President", "Interior security staff were caught tracking the executive's private motorcade and communications.", "common"),
        ("Gendarmerie Arms Armory Tampering", "Tear gas and crowd-control munitions were found sabotaged with expired, ineffective chemicals.", "common"),
        ("Whistleblower Releases Black Site Files", "A former intelligence officer releases photographs and logs of an unauthorized detention facility.", "common"),
        ("Refusal to Protect Government Buildings", "Police stood by and watched as demonstrators breached a regional governor's headquarters.", "common"),
        ("Border Patrol Checkpoint Abandonment", "Border agents walked away from a remote crossing post, leaving it unmonitored for twenty hours.", "common"),
        ("Selling Informant Files to Cartels", "An internal affairs investigator sold the complete file on a pending cartel strike to the suspects.", "rare"),
        ("Staging Violent False-Flag Incidents", "Rogue officers orchestrated an explosive attack on a radio station to blame civil rights groups.", "rare"),
        ("Armed Police Refusal to Enforce Law", "An entire municipal police department openly defies orders from the interior minister.", "rare"),
        ("Interior Minister Coup Conspiracy", "Intelligence reports reveal the interior minister held secret meetings with conspiratorial generals.", "rare"),
        ("Hostile Nation Intel in Police Systems", "Foreign intelligence agents were discovered with root administrative access to the police database.", "rare"),
        ("Leaking Executive Travel Security Routes", "Classified security plans for presidential travel were handed to an extremist group.", "rare"),
        ("Sabotage of Biometric Border Registry", "The national border database was intentionally wiped during a routine scheduled update.", "rare"),
        ("Secret Armed Militias Formed by Officials", "Interior directors covertly armed partisan paramilitaries to intimidate political rivals.", "rare"),
        ("Armed Police Mutiny in Capital", "Special weapons tactical units barricade themselves in headquarters, demanding cabinet resignations.", "epic"),
        ("Conspiracy to Free Cartel Kingpin", "Interior ministry commanders staged a fake prison riot to allow a notorious warlord to escape.", "epic"),
        ("Hostile Foreign Alliance of Security Chiefs", "Top security directors signed a secret mutual assistance pact with a hostile neighbor's spy agency.", "epic"),
        ("Internal Security Force Coup Mobilization", "Armored gendarmerie columns begin moving toward parliament without executive authorization.", "epic"),
        ("Compromised National Emergency System", "The emergency broadcast system and nationwide alarms were hijacked by rogue security factions.", "epic"),
        ("Total Armed Insurgency Orchestrated by Ministry", "The interior minister leads a coordinated nationwide mutiny to overthrow the government.", "legendary"),
        ("Sovereign Security Fracture and State Collapse", "The internal security forces split into warring warlord factions, plunging the nation into turmoil.", "legendary"),
    ],
    ('interior', 'improvement'): [
        ("Community Policing Initiative", "Foot patrols and neighborhood councils dramatically reduce street crime and build trust.", "common"),
        ("Automated Emergency Response Dispatch", "Modern GPS computer dispatch cuts police and ambulance response times by forty percent.", "common"),
        ("Digital Civil Registry Self-Service", "Citizens can renew identity cards and birth certificates online, ending long bureau queues.", "common"),
        ("Bicycle and Foot Patrol Expansion", "Visible, accessible police presence in commercial districts eliminates petty street theft.", "common"),
        ("Police Training De-escalation Success", "Comprehensive de-escalation training leads to a ninety percent reduction in use-of-force incidents.", "common"),
        ("Neighborhood Watch Network Integration", "Citizen watch groups connected via mobile apps alert police to suspicious activities rapidly.", "common"),
        ("Civil Protection Flood Readiness", "Interior disaster response squads rescue stranded communities and reinforce levees in record time.", "common"),
        ("Overhauled Prison Rehabilitation", "Vocational training in correctional facilities slashes criminal recidivism rates upon release.", "common"),
        ("Cross-Border Smuggling Interception", "Vigilant border guards seize a record shipment of contraband weapons and untaxed cigarettes.", "common"),
        ("Public Commendation for Police Integrity", "National surveys show citizen trust in law enforcement reaches its highest score in twenty years.", "common"),
        ("Major Crime Syndicate Dismantled", "A multi-agency sting arrests sixty top bosses of a violent extortion and racketeering cartel.", "rare"),
        ("National Violent Crime Drops to Historic Low", "Coordinated law enforcement strategies reduce national homicide and robbery rates to record lows.", "rare"),
        ("Fast-Track Forensic DNA Lab", "A state-of-the-art forensic biology lab clears years of backlogged cold case evidence.", "rare"),
        ("Rapid Disaster Relief Mobilization", "Interior civil defense forces restore electricity, water, and order within hours of an earthquake.", "rare"),
        ("Clean Hands Police Reform Triumph", "An aggressive anti-corruption purge eliminates dirty precinct chiefs, restoring institutional honor.", "rare"),
        ("Total Border Security Integrity", "Integrated thermal sensors and patrols achieve zero unrecorded crossings for an entire quarter.", "rare"),
        ("Successful Hostage Rescue Operation", "An elite police counter-terror unit frees dozens of hostages from an armed bank heist without injury.", "rare"),
        ("Cybercrime Taskforce Asset Seizures", "Digital investigators freeze and seize millions in cryptocurrency stolen by international scammers.", "rare"),
        ("Flawless National Public Order Record", "A year of contentious elections passes with complete peace, safety, and democratic stability.", "epic"),
        ("Complete Eradication of Organized Crime", "Every major organized crime family in the nation is permanently broken, tried, and imprisoned.", "epic"),
        ("Model Civil Protection Agency of the World", "International monitors designate our national civil defense system as the gold standard of public safety.", "epic"),
        ("Universal Citizen Security and Peace", "Every citizen nationwide can walk anywhere at any hour in absolute safety and tranquility.", "epic"),
        ("Infallible Forensic Justice System", "Forensic modernization guarantees that crime is detected immediately and justice is served without error.", "epic"),
        ("The Golden Age of National Harmony", "Total domestic peace, complete civic trust, and unquestioned rule of law define our sovereign society.", "legendary"),
        ("The Invincible Bastion of Domestic Tranquility", "Our homeland becomes the safest, most harmonious, and best-governed civilization on Earth.", "legendary"),
    ],
    ('interior', 'upgrade'): [
        ("Digital Police Radios and Bodycams", "Equipping officers with encrypted digital radios and body cameras increases accountability.", "common"),
        ("Mobile Automated License Plate Readers", "Patrol cruisers equipped with camera scanners identify stolen vehicles and warrants instantly.", "common"),
        ("Centralized Criminal Database Upgrade", "Unifying provincial arrest and warrant registries prevents fugitives from hiding across state lines.", "common"),
        ("High-Capacity Emergency Water Cannons", "Modern non-lethal crowd management vehicles enable peaceful dispersal without injuries.", "common"),
        ("Civil Protection All-Terrain Vehicles", "Supplying mountain and forest rescue units with amphibious vehicles speeds search operations.", "common"),
        ("Electronic Case Management for Courts", "Digitizing criminal case dockets ends document loss and speeds trial dates significantly.", "common"),
        ("Automated Fingerprint Identification Terminals", "Biometric fingerprint stations provide instant suspect identification at all precincts.", "common"),
        ("Secure Evidence Locker Vaults", "Climate-controlled, barcoded evidence lockers eliminate tampering and evidence degradation.", "common"),
        ("Fire Department Ladder Fleet Overhaul", "Procuring heavy hydraulic turntable ladders allows firefighters to reach high-rise blazes.", "common"),
        ("Emergency Civilian Alert Broadcast Towers", "Siren and radio broadcast towers provide instantaneous alerts for natural disasters or civil emergencies.", "common"),
        ("Integrated Biometric Border Gate Network", "Automated biometric e-gates process travelers with facial recognition, catching fraudulent passports.", "rare"),
        ("Advanced High-Tech Forensic Crime Lab", "Ballistics spectrometry and rapid DNA sequencing resolve violent crimes within hours.", "rare"),
        ("Autonomous Police Surveillance Drone Fleet", "Thermal drones patrol high-crime corridors at night, pinpointing illegal activity in real time.", "rare"),
        ("Unified Emergency Dispatch Command Center", "A consolidated 911 dispatch center routes police, fire, and medical teams with AI optimization.", "rare"),
        ("Rapid-Response Civil Defense Brigade", "A motorized brigade equipped with heavy excavation, bridging, and medical equipment deploys nationwide.", "rare"),
        ("Nationwide Traffic and Port CCTV Matrix", "High-definition camera networks covering all arterial highways and ports eliminate transit blind spots.", "rare"),
        ("Cyber Security Incident Response Division", "An elite cyber defense team protects critical infrastructure and municipal grids from hackers.", "rare"),
        ("Subterranean Crisis Management Bunker", "A hardened civil defense center buried beneath the capital ensures government continuity during disasters.", "rare"),
        ("AI-Powered Predictive Policing Engine", "Machine-learning models deploy patrol units to emerging crime hotspots before offenses occur.", "epic"),
        ("Nationwide Biometric Surveillance Mesh", "Ubiquitous facial recognition across transit hubs allows instantaneous tracking of wanted fugitives.", "epic"),
        ("Autonomous Disaster Rescue Robotics", "Robotic search dogs and tracked rescue drones locate survivors in collapsed rubble effortlessly.", "epic"),
        ("Hyperspectral Contraband Detection Gateways", "Container scanners detect trace narcotics, explosives, and nuclear materials in seconds.", "epic"),
        ("Master Homeland Security Command Hub", "An all-seeing operations center integrates police, satellite, traffic, and intelligence feeds.", "epic"),
        ("Total Sovereign Automated Civil Order Matrix", "An omniscient, benevolent civil protection apparatus guarantees absolute domestic safety.", "legendary"),
        ("The Eternal Bastion of Public Harmony", "The world's most advanced security architecture ensures unbroken peace across generations.", "legendary"),
    ],

    ('health', 'corruption'): [
        ("Pharmaceutical Procurement Bribes", "Ministry procurement officers took kickbacks from drug firms to buy overpriced antibiotics.", "common"),
        ("Hospital Bed Reservation Payoffs", "Desperate patients were forced to pay under-the-table cash to secure surgery beds.", "common"),
        ("Counterfeit Medication Distribution", "Substandard, diluted saline and counterfeit pain medication were supplied to rural clinics.", "common"),
        ("Ghost Clinic Reimbursement Scam", "Unregistered medical clinics billed the state millions for treatments that never occurred.", "common"),
        ("Medical Supply Black Market Resale", "Surgical gloves, masks, and needles were stolen from hospital basements and sold online.", "common"),
        ("Private Practice During State Shifts", "Senior doctors drew full state salaries while spending their shifts working at private luxury clinics.", "common"),
        ("Inflated Medical Equipment Leasing", "CT scanners and dialysis machines were leased from companies owned by the minister's family.", "common"),
        ("Hospital Laundry and Food Graft", "Contracts for patient meals were awarded to unvouched firms that delivered inedible, spoiled food.", "common"),
        ("Bribes for Medical Malpractice Immunity", "State health inspectors covered up fatal surgical errors in exchange for luxury holidays.", "common"),
        ("Ambulance Fuel Siphoning", "Emergency vehicle fuel was siphoned, leaving ambulances unable to respond to critical calls.", "common"),
        ("Secret Vaccine Batch Redirection", "Early batches of life-saving vaccines were covertly diverted to wealthy private clients.", "rare"),
        ("Hospital Construction Bribery Scheme", "A major regional hospital was constructed with missing fire exits after inspector payoffs.", "rare"),
        ("Organ Donor Allocation Fraud", "Organ transplant waiting lists were manipulated to move wealthy foreign paying clients to the top.", "rare"),
        ("Controlled Substance Diversion Syndicate", "Ministry custodians supplied thousands of boxes of medicinal opioids directly to street dealers.", "rare"),
        ("Health Ministry Travel Slush Fund", "Officials billed the treasury millions for overseas medical conferences that were luxury vacations.", "rare"),
        ("Substandard Ventilator Procurement", "Defective breathing machines that fail under load were purchased after substantial kickbacks.", "rare"),
        ("Blood Bank Commercial Exploitation", "Donated citizen blood was secretly exported to private foreign laboratories for profit.", "rare"),
        ("Falsified Clinical Trial Approvals", "Experimental pharmaceuticals were cleared for clinical release without required animal safety trials.", "rare"),
        ("National Health Insurance Fund Embezzlement", "Hundreds of millions from citizen health insurance premiums were invested in bankrupt offshore funds.", "epic"),
        ("Hospital Oxygen Monopolist Extortion", "A minister-backed monopoly jacked up medical oxygen prices threefold during a respiratory surge.", "epic"),
        ("Selling Confidential Citizen Health Records", "The complete medical database of every citizen was sold to foreign pharmaceutical conglomerates.", "epic"),
        ("Systemic Medical Research Grant Theft", "Cancer and immunology research grants were funneled into shell companies producing cosmetics.", "epic"),
        ("Health Minister Luxury Island Purchase", "Police discover the health minister purchased a private Caribbean island using hospital funds.", "epic"),
        ("Total Collapse of Public Healthcare into Extortion", "The entire public hospital system was transformed into a private profit-stripping racket.", "legendary"),
        ("The Grand Sovereign Medical Kleptocracy", "National healthcare was totally looted, leaving state hospitals as empty shells without medicine.", "legendary"),
    ],
    ('health', 'betrayal'): [
        ("Leaked Pandemic Outbreak Data", "Preliminary internal memos warning of a virulent viral strain were leaked to cause market panic.", "common"),
        ("Doctor Union Strike Ultimatum", "Junior doctors threaten an open-ended national strike unless the health budget is increased.", "common"),
        ("Medical Staff Walkout in Capital", "Nurses walk off the job at the premier teaching hospital, citing unbearable overtime and low wages.", "common"),
        ("Withholding Regional Disease Statistics", "A regional health director hid local cholera outbreaks to protect local tourist revenues.", "common"),
        ("Sabotage of Vaccine Cold Chain", "Deliberate disconnection of warehouse refrigeration units spoils thousands of vaccine doses.", "common"),
        ("Unauthorized Medical Patent Transfer", "A research scientist transferred state-developed therapeutic patents to a private firm.", "common"),
        ("Leaking Executive Health Records", "Confidential medical diagnoses of the head of state and cabinet were leaked to political enemies.", "common"),
        ("Health Ministry Defiance on Austerity", "Senior medical administrators publicly denounce cabinet spending cuts in live interviews.", "common"),
        ("Tampering with Water Safety Reports", "Water safety testing logs were suppressed to avoid alarming the public over chemical runoff.", "common"),
        ("Unauthorized Human Clinical Experiments", "A rogue research team conducted unsanctioned clinical trials on psychiatric patients.", "common"),
        ("Selling Pandemic Preparedness Stockpiles", "Strategic emergency protective gear reserves were sold to foreign buyers right before a surge.", "rare"),
        ("Health Minister Resignation Threat", "The health minister threatens to resign during a viral wave unless granted unchecked spending power.", "rare"),
        ("Intentional Delay of Disease Warnings", "Officials delayed quarantine declarations for weeks, allowing an outbreak to sweep the nation.", "rare"),
        ("Rival State Medical Espionage", "Foreign agents were caught stealing samples of experimental antiviral antibodies from state labs.", "rare"),
        ("Bio-Laboratory Protocol Breach Cover-Up", "A hazardous pathogen containment failure in an urban lab was concealed from civil authorities.", "rare"),
        ("Sabotage of Hospital Central Oxygen", "Valves at a major municipal hospital were tampered with, causing emergency ward evacuations.", "rare"),
        ("Public Health Misinformation Campaign", "Disgruntled doctors launched a covert online campaign urging citizens to reject state vaccines.", "rare"),
        ("Medical Staff Emigration Exodus", "Rival countries aggressively recruit our top surgeons and nurses with subsidized golden visas.", "rare"),
        ("Deliberate Release of Pathogen in Hospital", "A treasonous faction within medical research staged an intentional hospital contagion.", "epic"),
        ("Wholesale Defection of National Medical Cadre", "The entire senior professorial staff of the national medical school resigns en masse.", "epic"),
        ("Hostile Foreign Bio-Warfare Collusion", "A disgraced lab director was caught sharing biological agent vulnerabilities with enemy intelligence.", "epic"),
        ("Sabotage of National Pharmaceutical Synthesis", "Corrosive chemicals were poured into state vats producing the nation's insulin supply.", "epic"),
        ("Health Ministry Coup Conspiracy", "The health leadership coordinated with military dissenters to declare martial quarantine and seize power.", "epic"),
        ("Biological Catastrophe Orchestrated from Within", "Treasonous researchers unleash an engineered pathogen to force the capitulation of the government.", "legendary"),
        ("Total Collapse and Disintegration of National Healthcare", "The entire medical establishment refuses to serve the state, leaving the population defenseless.", "legendary"),
    ],
    ('health', 'improvement'): [
        ("Maternal Health Milestone", "New prenatal checkup protocols slash infant and maternal mortality to an all-time low.", "common"),
        ("Successful Childhood Vaccination Drive", "Mobile immunization vans reach remote villages, achieving ninety-eight percent coverage.", "common"),
        ("Hospital Waiting List Reductions", "Optimizing operating theater scheduling cuts elective surgery backlogs by half.", "common"),
        ("Emergency Ambulance Fleet Expansion", "Deploying dozens of new paramedical vans cuts critical cardiac response times.", "common"),
        ("Public Hygiene Awareness Campaign", "Clean hands and clean water outreach campaigns sharply reduce seasonal gastrointestinal illness.", "common"),
        ("Rural Telemedicine Clinic Rollout", "High-speed satellite connections connect village nurses with premier capital specialists.", "common"),
        ("Subsidized Generic Medicine Access", "Distributing low-cost generic pharmaceuticals ensures affordable treatment for chronic illnesses.", "common"),
        ("Mental Health Counseling Hotline", "A 24/7 psychological crisis helpline provides immediate support, reducing urban self-harm.", "common"),
        ("School Nutrition Program Triumph", "Providing balanced, protein-rich school lunches improves student physical stamina and grades.", "common"),
        ("Blood Donation Drive Surge", "A nationwide civic appeal leaves regional blood bank reserves completely full for emergencies.", "common"),
        ("Breakthrough Treatment Protocol Adopted", "Adopting modern immunotherapy protocols drastically improves cancer remission rates.", "rare"),
        ("Historic Elimination of Endemic Disease", "Decades of vector control officially eradicate malaria and dengue from national borders.", "rare"),
        ("Universal Free Primary Care Milestone", "Every citizen can visit a family doctor and receive essential diagnostics without any fee.", "rare"),
        ("Rapid Epidemic Containment Triumph", "Fast-response contact tracing halts a dangerous viral outbreak within two weeks of first detection.", "rare"),
        ("State-of-the-Art Cardiovascular Center", "A newly opened cardiac surgery hospital performs groundbreaking minimally invasive transplants.", "rare"),
        ("Clean Drinking Water for Every Citizen", "Completing national water chlorination grids eliminates waterborne disease across all provinces.", "rare"),
        ("National Life Expectancy Record", "Comprehensive public health gains increase the average citizen lifespan by three full years.", "rare"),
        ("World-Leading Emergency Trauma Network", "Helicopter medical evacuation connects every road accident directly to Level-1 trauma centers.", "rare"),
        ("National Healthcare Renaissance", "Our universal medical system is recognized internationally as an unparalleled triumph of human welfare.", "epic"),
        ("Total Eradication of Major Chronic Illnesses", "Preventive medicine and universal screening eliminate diabetes and heart disease complications.", "epic"),
        ("Pioneering Gene Therapy Miracle", "State laboratories develop affordable gene therapies that cure rare hereditary diseases permanently.", "epic"),
        ("Record-Breaking National Health and Longevity", "Citizens enjoy the highest Human Development Index and health metrics on the planet.", "epic"),
        ("Flawless Pandemic Resistance Fortress", "Our national biological defense and hospital reserves can withstand any global contagion effortlessly.", "epic"),
        ("The Golden Age of National Vitality", "Universal vitality, happiness, and physical vigor empower the nation with generational strength.", "legendary"),
        ("Eradication of Human Disease and Senescence", "Breakthrough regenerative medicine halts aging, granting our people vibrant health and longevity.", "legendary"),
    ],
    ('health', 'upgrade'): [
        ("Hospital Electronic Health Records", "Replacing paper charts with encrypted digital medical records ends medication errors.", "common"),
        ("Automated Diagnostic Blood Analyzers", "Installing automated blood labs in regional clinics provides test results in fifteen minutes.", "common"),
        ("Mobile Dental and Optical Vans", "Mobile health vans tour rural schools, providing free checkups and corrective eyewear.", "common"),
        ("Hospital HVAC Negative Pressure Rooms", "Upgrading isolation ward ventilation prevents airborne pathogen spread inside hospitals.", "common"),
        ("Digital Prescription Tracking System", "An electronic pharmacy registry stops dangerous drug interactions and opioid abuse.", "common"),
        ("Paramedic Defibrillator Fleet Upgrade", "Equipping every police and emergency vehicle with defibrillators triples cardiac saves.", "common"),
        ("Hospital Backup Power Generators", "Installing industrial diesel generators ensures intensive care units never lose electricity.", "common"),
        ("Sterilization Autoclave Modernization", "Modern high-pressure steam autoclaves eliminate surgical site bacterial infections.", "common"),
        ("Community Health Worker Tablet Kits", "Equipping community health aides with diagnostic tablets improves rural case detection.", "common"),
        ("Specialized Neonatal Intensive Care Incubators", "Procuring modern infant incubators ensures survival for premature babies.", "common"),
        ("Automated Disease Surveillance Network", "AI software monitors hospital admission patterns in real time to catch disease outbreaks instantly.", "rare"),
        ("High-Field MRI and PET Scanning Centers", "Equipping every regional hospital with magnetic resonance scanners enables early cancer detection.", "rare"),
        ("National Vaccine Synthesis Facility", "Constructing a domestic mRNA synthesis lab allows rapid vaccine production during bio-crises.", "rare"),
        ("Robotic Minimally Invasive Surgery Suites", "Surgical robots allow surgeons to operate with sub-millimeter precision, halving recovery times.", "rare"),
        ("Regional Trauma Helicopter Air Ambulances", "A fleet of medical evacuation helicopters brings trauma care to the most remote mountains.", "rare"),
        ("Automated Central Medical Supply Depots", "Robotic distribution centers ship medicines and surgical gear to clinics within two hours.", "rare"),
        ("High-Containment BSL-4 Research Complex", "A maximum-security biological lab studies dangerous pathogens in complete safety.", "rare"),
        ("National Cancer Proton Therapy Center", "A proton beam radiotherapy center treats tumors with zero damage to surrounding tissue.", "rare"),
        ("AI-Powered Clinical Diagnostic Superintelligence", "A diagnostic neural network assists doctors, diagnosing complex conditions with near-perfect accuracy.", "epic"),
        ("Automated Micro-Factory Pharmaceutical Synthesis", "Desktop chemical synthesizers produce rare medications on demand in every hospital pharmacy.", "epic"),
        ("Bio-Printing Organ Replacement Facility", "3D cellular bioprinters fabricate transplant-ready kidneys, livers, and hearts on demand.", "epic"),
        ("Nationwide Robotic Elder-Care Network", "Compassionate robotic care assistants support elderly citizens in their homes with dignity.", "epic"),
        ("Genetic Sequencing for Every Citizen", "Whole-genome sequencing allows personalized preventive medicine tailored to each individual.", "epic"),
        ("Universal Nanorobotic Immune Augmentation", "Injected therapeutic nanobots patrol the bloodstream, eradicating pathogens and cancerous cells.", "legendary"),
        ("The Immortal Sovereign Biosphere", "A completely perfected biomedical apparatus ensures eternal health, vitality, and immunity for all.", "legendary"),
    ],
}

def generate_choices(min_id, category, rarity, title):
    # Generates 2-3 tailored choices depending on category
    weight_map = {'common': 20, 'rare': 10, 'epic': 4, 'legendary': 1}
    die_check = 6 if rarity in ('common', 'rare') else 10
    dc = 3 if rarity == 'common' else 4 if rarity == 'rare' else 6 if rarity == 'epic' else 8

    if category == 'corruption':
        c1 = {
            "id": "investigate",
            "label": "Audit and Prosecute",
            "description": f"Conduct an aggressive inquiry. Roll d{die_check} > {dc}. Success: cleans corruption and restores funds. Failure: bureaucratic backlash.",
            "tone": "positive",
            "check": {"die": die_check, "dc": dc, "label": "Anti-Corruption Raid"},
            "success": {
                "corruption": -6 if rarity in ('common', 'rare') else -12,
                "approval": 4,
                "ministerCorruptionDelta": -15,
                "ministerLoyaltyDelta": -5,
                "moneyPctGdp": 0.004 if rarity in ('epic', 'legendary') else 0.002,
                "log": f"Corruption uncovered at {min_id.capitalize()} was prosecuted cleanly."
            },
            "failure": {
                "approval": -4,
                "ministerLoyaltyDelta": -12,
                "moneyPctGdp": -0.003,
                "log": f"Inquiry at {min_id.capitalize()} stalled amid factional resistance."
            }
        }
        c2 = {
            "id": "replace",
            "label": "Dismiss the Minister",
            "description": "Purge the leadership of this ministry and appoint a vetted replacement. Cost: 0.15% GDP.",
            "tone": "danger",
            "effects": {
                "moneyPctGdp": -0.0015,
                "replaceSpecificMinister": min_id,
                "corruption": -4,
                "approval": 2,
                "log": f"Leadership dismissed at {min_id.capitalize()} to excise corruption."
            }
        }
        c3 = {
            "id": "coverup",
            "label": "Quiet Settlement",
            "description": "Bury the scandal quietly to avoid market panic. Corruption +4, approval -2.",
            "tone": "default",
            "effects": {
                "corruption": 4,
                "approval": -2,
                "ministerLoyaltyDelta": 10,
                "ministerCorruptionDelta": 8,
                "log": f"Scandal at {min_id.capitalize()} was quietly settled behind closed doors."
            }
        }
        return [c1, c2, c3]

    elif category == 'betrayal':
        c1 = {
            "id": "counter_intel",
            "label": "Deploy Counter-Intelligence",
            "description": f"Intervene with internal security. Roll d{die_check} > {dc}. Success: neutralizes the threat. Failure: secrets leak out.",
            "tone": "positive",
            "check": {"die": die_check, "dc": dc, "label": "Security Sting"},
            "success": {
                "security": 6,
                "approval": 3,
                "ministerLoyaltyDelta": 20,
                "ministerCorruptionDelta": -10,
                "log": f"Treasonous plot at {min_id.capitalize()} was neutralized by security forces."
            },
            "failure": {
                "security": -6,
                "approval": -5,
                "ministerLoyaltyDelta": -20,
                "moneyPctGdp": -0.005,
                "log": f"Security breach at {min_id.capitalize()} caused severe damage."
            }
        }
        c2 = {
            "id": "purge",
            "label": "Executive Purge",
            "description": "Dismiss suspected conspirators immediately and replace leadership.",
            "tone": "danger",
            "effects": {
                "replaceSpecificMinister": min_id,
                "security": 4,
                "approval": -2,
                "moneyPctGdp": -0.002,
                "log": f"Decisive purge executed at {min_id.capitalize()}."
            }
        }
        c3 = {
            "id": "placate",
            "label": "Negotiate & Concede",
            "description": "Offer budgetary concessions to pacify disgruntled factions. Spends 0.4% GDP.",
            "tone": "default",
            "effects": {
                "moneyPctGdp": -0.004,
                "ministerLoyaltyDelta": 15,
                "approval": -1,
                "log": f"Concessions granted to pacify dissent at {min_id.capitalize()}."
            }
        }
        return [c1, c2, c3]

    elif category == 'improvement':
        c1 = {
            "id": "scale_up",
            "label": "Scale Up the Initiative",
            "description": "Invest additional funding to expand the breakthrough across the nation. Cost: 0.3% GDP.",
            "tone": "positive",
            "effects": {
                "moneyPctGdp": -0.003,
                "gdpPct": 0.005 if rarity in ('epic', 'legendary') else 0.002,
                "approval": 5,
                "ministerSkillDelta": 8,
                "ministryLevelDelta": 1 if rarity in ('epic', 'legendary') else 0,
                "log": f"Breakthrough at {min_id.capitalize()} was successfully scaled nationwide."
            }
        }
        c2 = {
            "id": "commend",
            "label": "Reward the Team",
            "description": "Issue presidential commendations and bonuses. Minister loyalty +15, approval +3.",
            "tone": "default",
            "effects": {
                "moneyPctGdp": -0.001,
                "approval": 3,
                "ministerLoyaltyDelta": 15,
                "ministerSkillDelta": 4,
                "log": f"Team at {min_id.capitalize()} commended for exemplary service."
            }
        }
        return [c1, c2]

    else: # upgrade
        c1 = {
            "id": "fund_upgrade",
            "label": "Authorize Full Modernization",
            "description": f"Commit capital to execute this institutional upgrade. Cost: {0.6 if rarity in ('epic', 'legendary') else 0.3}% GDP. Ministry Level +1.",
            "tone": "positive",
            "effects": {
                "moneyPctGdp": -0.006 if rarity in ('epic', 'legendary') else -0.003,
                "ministryLevelDelta": 1,
                "ministerSkillDelta": 6,
                "approval": 4,
                "gdpPct": 0.004,
                "log": f"Institutional upgrade implemented at {min_id.capitalize()}."
            }
        }
        c2 = {
            "id": "frugal_rollout",
            "label": "Phased Low-Cost Rollout",
            "description": "Implement a modest trial version. Minimal cost, minor skill improvement.",
            "tone": "default",
            "effects": {
                "moneyPctGdp": -0.0008,
                "ministerSkillDelta": 3,
                "approval": 1,
                "log": f"Phased upgrade initiated at {min_id.capitalize()}."
            }
        }
        return [c1, c2]

def build_ministry_events():
    events = []
    weight_map = {'common': 20, 'rare': 10, 'epic': 4, 'legendary': 1}
    log_category_map = {
        'finance': 'economy',
        'foreign': 'diplomacy',
        'defense': 'military',
        'industry': 'industry',
        'interior': 'governance',
        'health': 'governance',
    }

    for min_id in MINISTRIES:
        for cat in CATEGORIES:
            items = DATA.get((min_id, cat), [])
            for idx, (title, body, rarity) in enumerate(items, start=1):
                event_id = f"min_{min_id[:3]}_{cat[:3]}_{idx:02d}"
                choices = generate_choices(min_id, cat, rarity, title)
                # assign ministryId to choices effects so applyEventEffects can modify that ministry
                for ch in choices:
                    if 'effects' in ch:
                        ch['effects']['ministryId'] = min_id
                    if 'success' in ch:
                        ch['success']['ministryId'] = min_id
                    if 'failure' in ch:
                        ch['failure']['ministryId'] = min_id

                events.append({
                    "id": event_id,
                    "title": title,
                    "body": body,
                    "category": log_category_map[min_id],
                    "ministryId": min_id,
                    "ministryCategory": cat,
                    "rarity": rarity,
                    "weight": weight_map[rarity],
                    "choices": choices,
                })
    return events

BAILOUT_EVENTS_DATA = [
    (
        "bailout_emergency_appeal",
        "Emergency Bailout Request: Depleted Treasury",
        "A neighboring government has completely emptied its sovereign treasury (0M). Facing an immediate fiscal shutdown, civil unrest, and bankruptcy, their ambassador urgently appeals to our treasury for an emergency rescue grant.",
        "common"
    ),
    (
        "bailout_sovereign_insolvency",
        "Sovereign Insolvency Next Door",
        "State payrolls have stopped in an insolvent rival nation whose treasury sits at zero. Their prime minister warns that without bridge funding from our state, their government will default on debt and collapse into chaos.",
        "common"
    ),
    (
        "bailout_humanitarian_crisis",
        "Bankrupt Neighbor Seeks Humanitarian Credit",
        "Having depleted its treasury and exhausted credit lines, a neighboring nation cannot pay for food or energy imports. Their diplomatic mission formally petitions our government for an emergency liquidity lifeline.",
        "common"
    ),
    (
        "bailout_debt_distress_petition",
        "Distressed Sovereign Debt Petition",
        "A broke foreign power with zero treasury has been locked out of global bond markets. They offer bilateral trade privileges if our treasury injects capital to prevent runaway hyperinflation and debt default.",
        "rare"
    ),
    (
        "bailout_central_bank_swap",
        "Urgent Central Bank Liquidity Swap",
        "Foreign exchange reserves across the border have reached zero. Their central bank governor requests a bilateral currency swap to cover immediate government spending.",
        "rare"
    ),
    (
        "bailout_resource_concession",
        "Emergency Funds for Strategic Resource Rights",
        "Faced with zero treasury and unpaid civil service wages, a broke neighboring state offers to transfer strategic raw material stockpiles directly to us in exchange for a cash bailout.",
        "rare"
    ),
    (
        "bailout_border_stabilization",
        "Border Security Subsidy Appeal",
        "An insolvent neighbor cannot pay border guards and military patrols. They warn that without financial assistance, their border posts will be abandoned to armed syndicates.",
        "rare"
    ),
    (
        "bailout_default_prevention",
        "Preventing Regional Sovereign Default",
        "International creditors are preparing to declare an insolvent neighbor in formal sovereign default. Their finance minister begs our government to underwrite an emergency loan.",
        "rare"
    ),
    (
        "bailout_multilateral_accord",
        "Multilateral Creditor Rescue Package",
        "An international conference calls upon our wealthy treasury to co-sponsor an emergency stabilization package for an insolvent regional state with zero reserves.",
        "epic"
    ),
    (
        "bailout_grand_diplomatic_vassalage",
        "Total Sovereign Bailout in Exchange for Alliance",
        "A broke foreign regime on the brink of liquidation offers to align its foreign policy entirely with ours in exchange for a massive, comprehensive treasury bailout.",
        "legendary"
    )
]

def build_bailout_events():
    events = []
    weight_map = {'common': 20, 'rare': 10, 'epic': 4, 'legendary': 1}
    for idx, (ev_id, title, body, rarity) in enumerate(BAILOUT_EVENTS_DATA, start=1):
        events.append({
            "id": ev_id,
            "title": title,
            "body": body,
            "category": "diplomacy",
            "rarity": rarity,
            "weight": weight_map[rarity],
            "condition": "hasBrokeCountry",
            "choices": [
                {
                    "id": "grant_bailout",
                    "label": "Grant Emergency Bailout Relief",
                    "description": "Provide a rescue grant (1% of GDP). Resolves their immediate insolvency. Relations +35, approval +5, global prestige +15.",
                    "tone": "positive",
                    "effects": {
                        "moneyPctGdp": -0.01,
                        "allRelations": 12,
                        "approval": 5,
                        "log": "Granted emergency sovereign bailout to an insolvent neighbor."
                    }
                },
                {
                    "id": "high_interest_loan",
                    "label": "Offer High-Interest Distress Loan",
                    "description": "Lend 0.6% GDP on strict terms. They stay afloat but their debt rises to pay our treasury interest. Relations +10.",
                    "tone": "default",
                    "effects": {
                        "moneyPctGdp": -0.006,
                        "allRelations": 5,
                        "approval": 1,
                        "log": "Extended a high-interest sovereign distress loan to an insolvent state."
                    }
                },
                {
                    "id": "refuse_bailout",
                    "label": "Refuse the Bailout Request",
                    "description": "Spend nothing ($0). Unable to pay spending, their national debt surges with heavy penalties and relations sour. Relations -25.",
                    "tone": "danger",
                    "effects": {
                        "allRelations": -8,
                        "approval": -2,
                        "log": "Refused emergency bailout request; the broke foreign nation plunged into debt distress."
                    }
                }
            ]
        })
    return events

def emit_typescript():
    ministry_events = build_ministry_events()
    bailout_events = build_bailout_events()

    print(f"Total ministry events generated: {len(ministry_events)}")
    print(f"Total bailout events generated: {len(bailout_events)}")

    lines = []
    lines.append("import type { GameEventDefinition, GameState, Country } from './types'")
    lines.append("")
    lines.append("/** Helper checking if any rival living country has zero or negative treasury */")
    lines.append("export function hasBrokeCountry(state: GameState, _player: Country): boolean {")
    lines.append("  return state.countries.some(")
    lines.append("    (c) => c.status === 'alive' && !c.isPlayer && c.stats.treasury <= 0,")
    lines.append("  )")
    lines.append("}")
    lines.append("")

    # Emit ministry events
    lines.append("export const MINISTRY_EVENTS: GameEventDefinition[] = [")
    for ev in ministry_events:
        lines.append("  {")
        lines.append(f"    id: {json.dumps(ev['id'])},")
        lines.append(f"    title: {json.dumps(ev['title'])},")
        lines.append(f"    body: {json.dumps(ev['body'])},")
        lines.append(f"    category: {json.dumps(ev['category'])},")
        lines.append(f"    ministryId: {json.dumps(ev['ministryId'])},")
        lines.append(f"    ministryCategory: {json.dumps(ev['ministryCategory'])},")
        lines.append(f"    rarity: {json.dumps(ev['rarity'])},")
        lines.append(f"    weight: {ev['weight']},")
        lines.append("    choices: [")
        for ch in ev['choices']:
            lines.append("      {")
            lines.append(f"        id: {json.dumps(ch['id'])},")
            lines.append(f"        label: {json.dumps(ch['label'])},")
            lines.append(f"        description: {json.dumps(ch['description'])},")
            if 'tone' in ch:
                lines.append(f"        tone: {json.dumps(ch['tone'])},")
            if 'check' in ch:
                lines.append(f"        check: {json.dumps(ch['check'])},")
            if 'success' in ch:
                lines.append(f"        success: {json.dumps(ch['success'])},")
            if 'failure' in ch:
                lines.append(f"        failure: {json.dumps(ch['failure'])},")
            if 'effects' in ch:
                lines.append(f"        effects: {json.dumps(ch['effects'])},")
            lines.append("      },")
        lines.append("    ],")
        lines.append("  },")
    lines.append("]")
    lines.append("")

    # Emit bailout events
    lines.append("export const BAILOUT_REQUEST_EVENTS: GameEventDefinition[] = [")
    for ev in bailout_events:
        lines.append("  {")
        lines.append(f"    id: {json.dumps(ev['id'])},")
        lines.append(f"    title: {json.dumps(ev['title'])},")
        lines.append(f"    body: {json.dumps(ev['body'])},")
        lines.append(f"    category: {json.dumps(ev['category'])},")
        lines.append(f"    rarity: {json.dumps(ev['rarity'])},")
        lines.append(f"    weight: {ev['weight']},")
        lines.append("    condition: hasBrokeCountry,")
        lines.append("    choices: [")
        for ch in ev['choices']:
            lines.append("      {")
            lines.append(f"        id: {json.dumps(ch['id'])},")
            lines.append(f"        label: {json.dumps(ch['label'])},")
            lines.append(f"        description: {json.dumps(ch['description'])},")
            if 'tone' in ch:
                lines.append(f"        tone: {json.dumps(ch['tone'])},")
            if 'effects' in ch:
                lines.append(f"        effects: {json.dumps(ch['effects'])},")
            lines.append("      },")
        lines.append("    ],")
        lines.append("  },")
    lines.append("]")
    lines.append("")

    with open("src/game/ministryEvents.ts", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Wrote src/game/ministryEvents.ts successfully.")

if __name__ == '__main__':
    emit_typescript()
