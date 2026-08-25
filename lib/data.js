/* ---------- roster across the Providence federation (home node: The 903) ---------- */
export const MEMBERS = [
  { id: 1,  name: "Mira",    pronouns: "she/they", role: "Grower",      neighborhood: "The 903", skills: ["Permaculture", "Seed saving", "Soil testing"], interests: ["Mycology", "Fermentation", "Cartography"], bio: "Tends the garden beds and keeps the seed library catalogued by season.", email: "ycqugou@duck.com",},
  { id: 2,  name: "Tomas",   pronouns: "he/him",   role: "Fixer",       neighborhood: "The 903", skills: ["Bicycle repair", "Welding", "Small electronics"], interests: ["Ham radio", "Chess", "Field recording"], bio: "Volunteers at the bike collective. Nothing gets thrown out on his watch.", email: "qxdnrk15@duck.com",},
  { id: 3,  name: "Aisha",   pronouns: "she/her",  role: "Facilitator", neighborhood: "The 903", skills: ["Consensus process", "Mediation", "Note-taking"], interests: ["Printmaking", "Long-distance running", "Tea"], bio: "Holds the thread in long meetings and writes minutes nobody dreads reading.", email: "c2qx5017@duck.com",},
  { id: 4,  name: "Ravi",    pronouns: "he/him",   role: "Cook",        neighborhood: "The 903", skills: ["Batch cooking", "Bread", "Inventory"], interests: ["Jazz", "Cycling", "Hot sauce"], bio: "Coordinates the free kitchen. Claims his sourdough starter predates the block.", email: "zp5pl8b6@duck.com",},
  { id: 5,  name: "Lena",    pronouns: "she/her",  role: "Builder",     neighborhood: "The 903", skills: ["Carpentry", "Drywall", "CAD"], interests: ["Bouldering", "Synths", "Birding"], bio: "Led the rebuild of the community room over three rainy weekends." },
  { id: 6,  name: "Joon",    pronouns: "they/them",role: "Archivist",   neighborhood: "ONA", skills: ["Bookbinding", "Scanning", "Metadata"], interests: ["Zines", "Go", "Astronomy"], bio: "Keeps the shared library and the neighborhood's paper history in order.", email: "jp7cfank@duck.com",},
  { id: 7,  name: "Carmen",  pronouns: "she/her",  role: "Medic",       neighborhood: "The 903", skills: ["First aid", "Herbalism", "Training"], interests: ["Salsa", "Pottery", "Swimming"], bio: "Stocks the care kits and runs quarterly first-response workshops.", email: "awyhz93@duck.com",},
  { id: 8,  name: "Felix",   lastName: "Okonkwo", pronouns: "he/him",   role: "Coder",       neighborhood: "The 903", skills: ["Self-hosting", "Networking", "ActivityPub"], interests: ["Linux", "Trail running", "Coffee"], bio: "Keeps this very node online. Evangelist for federating across Providence.", email: "0pqxx887@duck.com",},
  { id: 9,  name: "Nadia",   pronouns: "she/her",  role: "Weaver",      neighborhood: "College Hill", skills: ["Textiles", "Natural dye", "Mending"], interests: ["Folk music", "Hiking", "Sketching"], bio: "Runs the mending circle and dyes wool with whatever the garden offers." },
  { id: 10, name: "Otis",    pronouns: "he/him",   role: "Driver",      neighborhood: "The 903", skills: ["Logistics", "Mechanics", "Routing"], interests: ["Vinyl", "Fishing", "Maps"], bio: "Moves goods between neighborhoods and never misses a pickup.", email: "8ivhduwc@duck.com",},
  { id: 11, name: "Sevda",   pronouns: "she/her",  role: "Teacher",     neighborhood: "The 903", skills: ["Literacy", "Translation", "Childcare"], interests: ["Poetry", "Gardening", "Languages"], bio: "Runs the kids' corner and translates federation notices into three languages.", email: "ker4c3c@duck.com",},
  { id: 12, name: "Bram",    pronouns: "he/him",   role: "Brewer",      neighborhood: "The 903", skills: ["Brewing", "Plumbing", "Glasswork"], interests: ["Cycling", "History", "Board games"], bio: "Makes the cider that shows up at every assembly afterparty." },
  { id: 13, name: "Yuki",    pronouns: "she/they", role: "Designer",    neighborhood: "ONA", skills: ["Layout", "Risograph", "Signage"], interests: ["Film photography", "Skating", "Ramen"], bio: "Designs posters and the look of the federation's shared notices.", email: "bveb5kkx@duck.com",},
  { id: 14, name: "Dario",   pronouns: "he/him",   role: "Grower",      neighborhood: "College Hill", skills: ["Beekeeping", "Grafting", "Composting"], interests: ["Accordion", "Walking", "Wine"], bio: "Tends the hives and trades honey across three neighborhoods.", email: "oa7n0bu5@duck.com",},
  { id: 15, name: "Priya",   pronouns: "she/her",  role: "Treasurer",   neighborhood: "The 903", skills: ["Bookkeeping", "Grant writing", "Spreadsheets"], interests: ["Knitting", "Documentaries", "Chai"], bio: "Keeps the common purse transparent and the dues ledger open to all.", email: "sw5hfa5t@duck.com",},
  { id: 16, name: "Sol",     pronouns: "they/them",role: "Gardener",    neighborhood: "The 903", skills: ["Aquaponics", "Irrigation", "Pruning"], interests: ["Climbing", "Comics", "Cooking"], bio: "Designed the greywater loop that keeps the greenhouse running through summer." },
  { id: 17, name: "Hana",    pronouns: "she/her",  role: "Organizer",   neighborhood: "The 903", skills: ["Outreach", "Events", "Phone trees"], interests: ["Dance", "Cooking", "Activism"], bio: "Connects The 903 to its neighbors and never forgets a name.", email: "je53d2ye@duck.com",},
  { id: 18, name: "Mateo",   pronouns: "he/him",   role: "Carpenter",   neighborhood: "The 903", skills: ["Joinery", "Tool sharpening", "Salvage"], interests: ["Surf", "Whittling", "Coffee"], bio: "Built the assembly benches from salvaged church pews.", email: "tdjjxic5@duck.com",},
  { id: 19, name: "Greta",   pronouns: "she/her",  role: "Steward",     neighborhood: "The 903", skills: ["Conflict resolution", "Scheduling", "Care work"], interests: ["Choir", "Foraging", "Cats"], bio: "Holds the care rota and checks in on members between assemblies." },
  { id: 20, name: "Idris",   pronouns: "he/him",   role: "Printer",     neighborhood: "College Hill", skills: ["Screen printing", "Repair", "Inks"], interests: ["Football", "Cooking", "Murals"], bio: "Runs the print room; every banner at the last march came off his press.", email: "gjsz0aok@duck.com",},
  { id: 21, name: "Jeremy",  pronouns: "he/him",   role: "Cook",        neighborhood: "ONA", skills: ["Batch cooking", "Food rescue", "Logistics"], interests: ["Punk shows", "Gardening", "Bread"], bio: "Cooks for the weekly Food Not Bombs share and runs the produce-rescue route.", email: "a44v5y6@duck.com",},
  { id: 22, name: "Esperanza", pronouns: "she/her", role: "Solar tech", neighborhood: "ONA", skills: ["Solar install", "Electrical", "Site survey"], interests: ["Cycling", "Astronomy", "Welding"], bio: "Installs panels with Sol Power; believes the grid should belong to the people on it.", email: "1hh8c8h@duck.com",},
  { id: 23, name: "Wren", pronouns: "they/them", role: "Medical illustrator", neighborhood: "College Hill", skills: ["3D modeling", "Anatomy", "Animation"], interests: ["Tabletop games", "Birding", "Printmaking"], bio: "Builds anatomical models at 3D Anatomy Studios; teaches a free Blender night.", email: "e7alw0q@duck.com",},
  { id: 24, name: "Marisol", pronouns: "she/her", role: "Florist", neighborhood: "The 903", skills: ["Floral design", "Foraging", "Events"], interests: ["Hiking", "Poetry", "Ceramics"], bio: "Designs seasonal arrangements at Four Buds; grows half the stems herself.", email: "df5rzwg@duck.com",},
  { id: 25, name: "Gus", pronouns: "he/him", role: "Grower", neighborhood: "ONA", skills: ["Propagation", "Soil", "Perennials"], interests: ["Fishing", "Mandolin", "Composting"], bio: "Runs the benches at Nuts & Bolts; knows which plant will actually survive your apartment.", email: "r3ciils@duck.com",},
  { id: 26, name: "Paloma", pronouns: "she/her", role: "Doula", neighborhood: "The 903", skills: ["Birth support", "Postpartum care", "Bilingual care"], interests: ["Salsa", "Herbalism", "Reading"], bio: "Birth and postpartum doula with Doulas Conectadas; organizes the parent mutual-aid circle.", email: "ik3xzco@duck.com",},
  { id: 27, name: "Boone", pronouns: "he/him", role: "Bookseller", neighborhood: "College Hill", skills: ["Curation", "Events", "Inventory"], interests: ["Chess", "Jazz", "Letterpress"], bio: "Tends the shelves at Heartleaf Books and hosts the Thursday reading group.", email: "prkuzx19@duck.com",},
  { id: 28, name: "Thea", pronouns: "she/her", role: "Cook", neighborhood: "ONA", skills: ["Baking", "Preserving", "Menu planning"], interests: ["Foraging", "Accordion", "Canning"], bio: "Bakes and preserves at Milk Thistle Kitchen; sources from the co-op growers down the street.", email: "5npygvjm@duck.com",},
  { id: 29, name: "Rune", pronouns: "they/them", role: "Gallerist", neighborhood: "The 903", skills: ["Curation", "Bartending", "Install"], interests: ["Synths", "Film photography", "Zines"], bio: "Helps run Small Format — pours cocktails, hangs shows, and locks up after.", email: "1aeun89@duck.com",},
  { id: 30, name: "Ilana", pronouns: "she/her", role: "Herbalist", neighborhood: "College Hill", skills: ["Herbalism", "Tinctures", "Teaching"], interests: ["Foraging", "Watercolor", "Tea"], bio: "Blends remedies at the RI Herbal Co-op and runs the intro apothecary workshop.", email: "xg3s33j@duck.com",},
];

/* ---------- organizations across the Providence federation ----------
   Real Providence co-ops & collectives, plus each neighborhood's own
   Neighborhood Council. Orgs nest via `parentId` (another org's id, or
   `null` for root-level — today that's the 3 Neighborhood Councils and
   every Providence-wide org). A Neighborhood Council additionally carries
   `neighborhood`, marking it as one of the 3 places every resident of that
   neighborhood is automatically a member of — see `orgMembers()` in
   `lib/orgs.util.js`, which resolves that instead of reading `members`
   directly for these 3 entries (their own `members` array is unused).
   `members` (everywhere else) are member ids visible from the home node.
   `offers`/`facts` as before. */
export const ORGS = [
  {
    id: "the-903-council",
    name: "The 903 Neighborhood Council",
    kind: "Council",
    parentId: null,
    neighborhood: "The 903",
    tagline: "Every resident of The 903, together.",
    about: "The 903's neighborhood council — every resident is automatically a member. Proposes and votes on neighborhood meetings, and is the home for the block's standing councils (Finance, Grounds, Community) and neighborhood-scoped groups.",
    offers: [],
    members: [],
    facts: [],
  },
  {
    id: "ona-council",
    name: "ONA Neighborhood Council",
    kind: "Council",
    parentId: null,
    neighborhood: "ONA",
    tagline: "Every resident of ONA, together.",
    about: "ONA's neighborhood council — every resident is automatically a member.",
    offers: [],
    members: [],
    facts: [],
  },
  {
    id: "college-hill-council",
    name: "College Hill Neighborhood Council",
    kind: "Council",
    parentId: null,
    neighborhood: "College Hill",
    tagline: "Every resident of College Hill, together.",
    about: "College Hill's neighborhood council — every resident is automatically a member.",
    offers: [],
    members: [],
    facts: [],
  },
  {
    id: "coalition",
    name: "Coalition for the Unhoused",
    kind: "Collective",
    parentId: "the-903-council",
    tagline: "Housing is a right, not a reward.",
    about: "A neighborhood collective organizing mutual aid and advocacy alongside unhoused neighbors. Runs a weekly supply distribution, a warm-handoff network to services, and shows up for eviction defense and encampment solidarity across the block.",
    offers: ["Supply distribution", "Eviction defense", "Warm meals", "Cold-weather kits", "Know-your-rights", "Housing advocacy"],
    members: [17, 7, 19, 11],
    lastEditedBy: 11, lastEditedAt: "2026-01-26T00:00:00.000Z",
    facts: [["Founded", "2022"], ["Distros", "Weekly"], ["Volunteers", "30+"], ["Dues", "None"]],
    join: "Come to a Thursday distribution, or join the supply-run and advocacy crews.",
    contact: "unhoused@duck.com",
  },
  {
    id: "finance-council",
    name: "Finance Council",
    kind: "Council",
    parentId: "the-903-council",
    tagline: "Keeps the block's shared money honest.",
    about: "The 903's standing council for shared finances — the dues ledger, mutual-aid fund, and small grants that keep neighborhood projects running. Meets monthly to review the books in the open and vote on requests from other groups on the block.",
    offers: ["Dues ledger", "Mutual-aid fund", "Small grants", "Budget review", "Open books", "Grant requests"],
    members: [15, 8, 1],
    lastEditedBy: 15, lastEditedAt: "2026-06-02T00:00:00.000Z",
    facts: [["Founded", "2023"], ["Meets", "Monthly"], ["Fund", "Open to all"], ["Books", "Public"]],
    join: "Come to a monthly meeting — the books are open to any resident of The 903.",
    contact: "financecouncil903@duck.com",
  },
  {
    id: "grounds-council",
    name: "Grounds Council",
    kind: "Council",
    parentId: "the-903-council",
    tagline: "Stewards the shared spaces on the block.",
    about: "The 903's standing council for shared physical spaces — the community room, garden beds, greywater loop, and whatever needs fixing before it becomes an emergency. Coordinates workdays and keeps a running repair list the whole block can see.",
    offers: ["Workdays", "Repair list", "Garden upkeep", "Tool loans", "Space scheduling", "Seasonal prep"],
    members: [16, 5, 18],
    lastEditedBy: 16, lastEditedAt: "2026-04-18T00:00:00.000Z",
    facts: [["Founded", "2022"], ["Workdays", "Twice a month"], ["Repairs", "Open list"], ["Tools", "Shared shed"]],
    join: "Show up to a workday — the repair list always has room for another pair of hands.",
    contact: "grounds903@duck.com",
  },
  {
    id: "community-council",
    name: "Community Council",
    kind: "Council",
    parentId: "the-903-council",
    tagline: "Holds the thread between neighbors.",
    about: "The 903's standing council for community life — welcoming new neighbors, checking in on folks between assemblies, and connecting residents to the right group for what they need. The first stop for anyone wondering where to plug in.",
    offers: ["Neighbor welcome", "Check-ins", "Group referrals", "Event calendar", "Care rota", "New-resident orientation"],
    members: [17, 3, 19],
    lastEditedBy: 17, lastEditedAt: "2026-05-20T00:00:00.000Z",
    facts: [["Founded", "2021"], ["Check-ins", "Ongoing"], ["New neighbors", "Welcomed"], ["Model", "Rotating chairs"]],
    join: "Reach out any time — the council is the front door for anyone new to the block.",
    contact: "community903@duck.com",
  },
  {
    id: "pvd-things",
    name: "PVD Things",
    kind: "Collective",
    parentId: null,
    tagline: "We've got the things you need.",
    about: "A cooperative lending library in Olneyville providing affordable access to tools, things, and skills. Like a friendly neighbor, PVD Things shares what people need so they can get stuff done — from power tools to outdoor games — and runs workshops to teach the skills to use them.",
    offers: ["Power tools", "Hand tools", "Outdoor games", "Electronics", "Workshops", "DIY tutorials"],
    members: [2, 18, 10, 16, 8],
    lastEditedBy: 10, lastEditedAt: "2026-05-10T00:00:00.000Z",
    facts: [["Founded", "2021"], ["Members", "425+"], ["Things", "1,400+"], ["Hours", "Tue/Wed/Sat"]],
    join: "Become a member at any membership level — borrow your first thing the same week.",
    contact: "hello@pvdthings.coop",
    website: "pvdthings.coop",
    address: "12 Library Court, Providence, RI",
    hours: [["Tue", "4–8pm"], ["Wed", "4–8pm"], ["Sat", "11am–3pm"]],
  },
  {
    id: "urban-greens",
    name: "Urban Greens",
    kind: "Consumer co-op",
    parentId: null,
    tagline: "A full-service grocery the shoppers own.",
    about: "A member-owned cooperative grocery on the West Side stocking local produce, bulk staples, and goods from co-ops around the region. One member, one vote. Open to everyone; members share in the governance and the surplus.",
    offers: ["Local produce", "Bulk dry goods", "Dairy & eggs", "Prepared foods", "Member ordering", "Patronage dividend"],
    members: [4, 15, 11, 1],
    lastEditedBy: 15, lastEditedAt: "2026-01-26T00:00:00.000Z",
    facts: [["Founded", "2017"], ["Members", "2,000+"], ["Model", "One member, one vote"], ["Buy-in", "Equity share"]],
    join: "Buy a one-time equity share to become a member-owner. Shopping is open to all.",
    contact: "hello@urbangreens.com",
  },
  {
    id: "lefty-loosey",
    name: "Lefty Loosey Bike Collective",
    kind: "Collective",
    parentId: null,
    tagline: "Rhode Island's worker-run community bicycle workshop.",
    about: "A worker-run community bike shop maintaining a space for teaching, learning, repair, redistribution, and joy. Rooted in racial, economic, and environmental justice — a place where BIPOC, queer and trans folks, and women belong in a hands-on mechanics space.",
    offers: ["Open repair hours", "Mechanics classes", "Bike redistribution", "Wheel building", "Used bikes", "Community rides"],
    members: [2, 10, 16],
    lastEditedBy: 16, lastEditedAt: "2026-05-24T00:00:00.000Z",
    facts: [["Founded", "2021"], ["Model", "Worker-run"], ["Address", "50 Sims Ave"], ["Cost", "Sliding scale"]],
    join: "Drop in during open shop hours, or join a class to learn to fix your own ride.",
    contact: "hello@leftylooseybikecollective.org",
  },
  {
    id: "white-electric",
    name: "White Electric Coffee",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned coffee on the West Side.",
    about: "A worker-owned cafe and neighborhood fixture, converted to a cooperative and run by its baristas as equal owners. A daily gathering place that hosts community meetings, hangs local art, and keeps the lights on for the block.",
    offers: ["Coffee & espresso", "Pastries", "Community space", "Meeting room", "Local art wall", "Worker ownership"],
    members: [4, 12, 13],
    lastEditedBy: 4, lastEditedAt: "2026-02-05T00:00:00.000Z",
    facts: [["Est.", "2000"], ["Unionized", "2020"], ["Worker co-op", "2021"], ["Owners", "Equal baristas"]],
    join: "Worker-ownership opens to baristas after a trial period; everyone else, just stop in.",
    contact: "hello@whiteelectriccoffee.com",
    website: "whiteelectriccoffee.com",
    address: "711 Westminster St, Providence, RI",
    hours: [["Mon–Fri", "7am–3pm"], ["Sat–Sun", "8am–2pm"]],
  },
  {
    id: "ona-garden",
    name: "Olneyville Community Garden",
    kind: "Collective",
    parentId: "ona-council",
    tagline: "Land held in common, food grown together.",
    about: "A collectively tended garden and orchard on reclaimed Olneyville lots, organized through the Olneyville Neighborhood Association. Plots are worked in common; the harvest is shared by need, traded across the federation, and donated to the free kitchen.",
    offers: ["Seasonal produce", "Seedlings", "Seed library", "Compost", "Honey", "Work-trade days"],
    members: [1, 6, 13, 16],
    lastEditedBy: 1, lastEditedAt: "2025-09-28T00:00:00.000Z",
    facts: [["Founded", "2018"], ["Lots", "5 reclaimed"], ["Beds", "40+"], ["Workdays", "Sun mornings"]],
    join: "Come to a Sunday workday. Hands in the soil are the only membership requirement.",
    contact: "garden@proton.me",
  },
  {
    id: "brown-fnb",
    name: "Brown Food Not Bombs",
    kind: "Collective",
    parentId: "college-hill-council",
    tagline: "Solidarity, not charity — on the hill.",
    about: "The Brown University chapter of Food Not Bombs, a student-and-neighbor collective recovering surplus food and serving free vegetarian meals on College Hill. Part of the global Food Not Bombs movement — a stand against the waste of food and the waste of war.",
    offers: ["Free hot meals", "Food rescue", "Public food share", "Community cooking", "Surplus redistribution", "No questions asked"],
    members: [9, 14, 20],
    lastEditedBy: 9, lastEditedAt: "2026-05-13T00:00:00.000Z",
    facts: [["Chapter", "Brown University"], ["Share", "Weekly, public"], ["Cost", "Always free"], ["Model", "All-volunteer"]],
    join: "Come to a cook or a share — students and neighbors both welcome.",
    contact: "brownfnb@duck.com",
  },
  {
    id: "food-not-bombs",
    name: "Food Not Bombs",
    kind: "Collective",
    parentId: null,
    tagline: "Solidarity, not charity. Free food for all.",
    about: "An all-volunteer collective recovering surplus food and cooking free vegetarian meals shared in public, every week, with no questions asked. Part of the global Food Not Bombs movement — a stand against the waste of food and the waste of war.",
    offers: ["Free hot meals", "Food rescue", "Public food share", "Community cooking", "Surplus redistribution", "No questions asked"],
    members: [21, 4, 17, 7],
    lastEditedBy: 4, lastEditedAt: "2026-05-08T00:00:00.000Z",
    facts: [["Founded", "2009"], ["Share", "Weekly, public"], ["Cost", "Always free"], ["Model", "All-volunteer"]],
    join: "Show up to a cook or a share — bring a pot, a ride, or just your hands.",
    contact: "pvdfnb@proton.me",
  },
  {
    id: "sol-power",
    name: "Sol Power Solar",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned solar for Rhode Island.",
    about: "A worker-owned solar installation cooperative. The crew that designs and mounts your panels are the same people who own the business and share in its decisions and surplus — clean energy without a boss taking the cut.",
    offers: ["Solar installation", "System design", "Site assessment", "Maintenance", "Consultation", "Worker ownership"],
    members: [22],
    lastEditedBy: 22, lastEditedAt: "2026-06-17T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Trade", "Solar"], ["Owners", "Equal crew"], ["Member of", "RIWCA"]],
    join: "Hiring is by the crew, who become owners after a trial period. Get a quote anytime.",
    contact: "hello@solpowersolar.com",
  },
  {
    id: "3d-anatomy",
    name: "3D Anatomy Studios",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned 3D medical visualization.",
    about: "A worker-owned studio producing 3D anatomical models, medical animation, and scientific visualization. Owned and run by the artists and technologists who make the work.",
    offers: ["3D modeling", "Medical animation", "Scientific illustration", "Visualization", "Consultation", "Worker ownership"],
    members: [23],
    lastEditedBy: 23, lastEditedAt: "2026-02-13T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Field", "Med viz"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Bring a project, or inquire about joining the studio as a worker-owner.",
    contact: "hello@3danatomystudios.com",
  },
  {
    id: "four-buds",
    name: "Four Buds Floral Studio",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned flowers, grown with care.",
    about: "A worker-owned floral studio doing arrangements, weddings, and events with a focus on local and seasonal stems. The florists share ownership of the studio and its work.",
    offers: ["Arrangements", "Weddings", "Events", "Seasonal bouquets", "Local stems", "Worker ownership"],
    members: [24],
    lastEditedBy: 24, lastEditedAt: "2026-03-25T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Trade", "Floristry"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Order for an event, or ask about joining the studio.",
    contact: "hello@fourbudsfloral.com",
  },
  {
    id: "nuts-bolts",
    name: "Nuts & Bolts Nursery",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned plants and growing supplies.",
    about: "A worker-owned plant nursery and garden supply co-op. Owned by the growers, offering seedlings, perennials, and the know-how to keep them alive.",
    offers: ["Seedlings", "Perennials", "Houseplants", "Garden supplies", "Growing advice", "Worker ownership"],
    members: [25],
    lastEditedBy: 25, lastEditedAt: "2025-09-07T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Trade", "Nursery"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Stop by to shop, or ask about becoming a worker-owner.",
    contact: "hello@nutsandboltsnursery.com",
  },
  {
    id: "doulas-conectadas",
    name: "Doulas Conectadas",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned birth and postpartum support.",
    about: "A worker-owned cooperative of doulas providing birth, postpartum, and community care, with deep roots in Rhode Island's Latine community. The doulas own the cooperative and share its work and decisions.",
    offers: ["Birth doula care", "Postpartum support", "Community care", "Bilingual support", "Education", "Worker ownership"],
    members: [26],
    lastEditedBy: 26, lastEditedAt: "2026-04-12T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Care", "Doula"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Reach out for support, or connect to join the cooperative.",
    contact: "doulasconectadas@duck.com",
  },
  {
    id: "heartleaf-books",
    name: "Heartleaf Books",
    kind: "Worker co-op",
    parentId: null,
    tagline: "A bookstore the workers own together.",
    about: "A worker-owned cooperative bookstore, owned and run by its booksellers as equals. Curated shelves, author events, and a gathering place for readers — governed by the people who staff it.",
    offers: ["Books", "Author events", "Community space", "Special orders", "Reading groups", "Worker ownership"],
    members: [27],
    lastEditedBy: 27, lastEditedAt: "2026-05-30T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Trade", "Bookstore"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Shop the shelves, come to an event, or apply to join the worker team.",
    contact: "hello@heartleafbooks.com",
  },
  {
    id: "milk-thistle",
    name: "Milk Thistle Kitchen",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned food, made from scratch.",
    about: "A worker-owned kitchen cooperative making prepared foods and baked goods from scratch. Owned by the cooks, with an eye toward local ingredients and fair work.",
    offers: ["Prepared foods", "Baked goods", "Catering", "Local ingredients", "Seasonal menu", "Worker ownership"],
    members: [28],
    lastEditedBy: 28, lastEditedAt: "2026-05-02T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Trade", "Kitchen"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Order from the kitchen, or ask about joining as a worker-owner.",
    contact: "milkthistle@proton.me",
  },
  {
    id: "small-format",
    name: "Small Format",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Coffee, cocktails, art, and community.",
    about: "A queer, cooperatively run art gallery and exhibition room offering coffee, cocktails, art, and community. Owned and run by its workers as a gathering place for shows, drinks, and one another.",
    offers: ["Art gallery", "Exhibitions", "Coffee", "Cocktails", "Community space", "Worker ownership"],
    members: [29],
    lastEditedBy: 29, lastEditedAt: "2025-12-24T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Space", "Gallery & bar"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Stop in for a coffee or a show, or ask about joining the collective.",
    contact: "hello@smallformat.one",
  },
  {
    id: "ri-herbal",
    name: "RI Herbal Co-op",
    kind: "Worker co-op",
    parentId: null,
    tagline: "Worker-owned herbalism and remedies.",
    about: "A worker-owned herbal cooperative growing, blending, and sharing herbal remedies and knowledge across Rhode Island. Owned by the herbalists who make the work.",
    offers: ["Herbal remedies", "Tinctures & teas", "Workshops", "Consultations", "Apothecary", "Worker ownership"],
    members: [30],
    lastEditedBy: 30, lastEditedAt: "2026-05-04T00:00:00.000Z",
    facts: [["Model", "Worker co-op"], ["Trade", "Herbalism"], ["Owners", "Equal"], ["Member of", "RIWCA"]],
    join: "Visit the apothecary, take a workshop, or ask about joining.",
    contact: "riherbal@duck.com",
  },
];

/* member id -> orgs they belong to (derived once) */
export const ORGS_BY_MEMBER = MEMBERS.reduce((acc, m) => {
  acc[m.id] = ORGS.filter((o) => o.members.includes(m.id));
  return acc;
}, {});

/* the signed-in member, so RSVPs read in the first person */
export const CURRENT_USER_ID = 8; // Felix

/* event kinds. ordinary events are scheduled instantly by anyone; governance
   events (meetings, council) are *proposed* and need a quorum of votes to be
   confirmed. For the prototype, proposing adds it to the list right away.
   A meeting is hosted by a Neighborhood Council (see lib/orgs.util.js) and
   confirms by a majority of that council's own (derived) membership — see
   meetingThreshold() in lib/governance.util.js — rather than a fixed number
   like council still uses below; there's no single "right" percentage yet
   ("we should use a fixed percentage of the total membership" — TBD which
   one), so meetingThreshold isolates that choice to one place. */
export const EVENT_KINDS = {
  ordinary:  { governance: false, label: "Event" },
  meeting:   { governance: true,  label: "Neighborhood Council Meeting" },
  council:   { governance: true,  label: "Federation Council Meeting", threshold: 8 },
};
// a council proposal must be ratified by the sponsoring assembly's own quorum
// before it becomes a federation-wide proposed council.
export const COUNCIL_RATIFY_THRESHOLD = 5;

/* ---------- upcoming events across the federation ----------
   host is either { type: "member", id } or { type: "org", id };
   `date` is an ISO day, `rsvps` is a list of member ids.

   Event dates are generated relative to the real current date via
   dayFromNow(offset), so the demo always shows the same spread of past and
   upcoming events no matter when it's opened. Offsets were chosen to preserve
   the original hand-authored timeline (anchored around a reference "today"). */
export function dayFromNow(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export const EVENTS = [
  {
    id: "e1",
    title: "Thursday Supply Distribution",
    host: { type: "org", id: "coalition" },
    date: dayFromNow(-12), start: "16:00", end: "19:00",
    location: "The 903 community room + Dexter Park",
    description: "Weekly distribution of food, water, hygiene kits, and cold-weather gear alongside unhoused neighbors. Come pack bags, run a supply route, or staff the know-your-rights table. New volunteers always welcome — no experience needed.",
    rsvps: [17, 7, 19, 11, 8],
  },
  {
    id: "e2",
    title: "Sunday Workday & Seed Swap",
    host: { type: "org", id: "ona-garden" },
    date: dayFromNow(-9), start: "09:00", end: "12:00",
    location: "Olneyville Community Garden, off Manton Ave",
    description: "Weeding, mulching, and getting the late-summer beds in. Bring seeds to trade for the swap table. Kids welcome. Coffee and bread from the free kitchen.",
    rsvps: [1, 6, 13, 16, 4],
  },
  {
    id: "e3",
    title: "Open Repair Hours",
    host: { type: "org", id: "lefty-loosey" },
    date: dayFromNow(-7), start: "18:00", end: "21:00",
    location: "Lefty Loosey, 50 Sims Ave",
    description: "Stands, tools, and mechanics on hand to help you fix your own ride. Learn as you go — this is a teaching space, not a drop-off shop. Sliding scale for parts; nobody turned away.",
    rsvps: [2, 10, 16, 8],
  },
  {
    id: "e4",
    title: "Consensus Facilitation Workshop",
    host: { type: "member", id: 3 },
    date: dayFromNow(-6), start: "18:30", end: "20:30",
    location: "White Electric Coffee, back room",
    description: "A hands-on intro to running meetings by consensus: stack-keeping, temperature checks, blocks vs. stand-asides, and writing minutes nobody dreads. Useful for anyone holding a working group.",
    rsvps: [3, 17, 15, 11],
  },
  {
    id: "e5",
    title: "Borrowing 101 at PVD Things",
    host: { type: "org", id: "pvd-things" },
    date: dayFromNow(-2), start: "11:00", end: "13:00",
    location: "PVD Things, 12 Library Ct, Olneyville",
    description: "New to the library of things? Tour the stacks, learn how membership and borrowing work, and check out your first tool. Walk through the workshop calendar and the wish list while you're here.",
    rsvps: [2, 18, 10, 16, 1],
  },
  {
    id: "e10",
    title: "Open Hours — Saturday Shift",
    host: { type: "org", id: "pvd-things" },
    date: dayFromNow(4), start: "10:00", end: "14:00",
    location: "PVD Things, 12 Library Ct, Olneyville",
    description: "Our regular Saturday lending hours. The shift runs only if a shift lead is signed up — leads open and close, handle membership, and hold the keys. Librarians help patrons find and check out things; the more the merrier. Grab a slot below.",
    // role-based slots: a shift lead is required (min 1) or the shift can't run;
    // librarians are unlimited and optional (min 0).
    roles: [
      { key: "lead", label: "Shift lead", min: 1, members: [] },
      { key: "librarian", label: "Librarian", min: 0, members: [10, 2] },
    ],
    rsvps: [],
  },
  {
    id: "e12",
    title: "Member Potluck & Year Planning",
    host: { type: "org", id: "pvd-things" },
    membersOnly: true,
    date: dayFromNow(1), start: "18:00", end: "20:30",
    location: "PVD Things, 12 Library Ct, Olneyville",
    description: "Members-only evening: bring a dish, hear where the library's budget stands, and help set priorities for the coming year — new tool categories, weekend hours, and the repair-cafe schedule. Bring ideas and an appetite.",
    rsvps: [2, 18, 10],
  },
  {
    id: "e6",
    title: "Providence Federation Council",
    kind: "council",
    scope: "federation",
    sponsor: { id: "e8", name: "The 903 Neighborhood Council Meeting", neighborhood: "The 903" },
    host: { type: "member", id: 17 },
    date: dayFromNow(-3), start: "16:00", end: "19:00",
    location: "White Electric + remote neighborhoods",
    description: "Quarterly council with delegates from The 903, ONA, and College Hill. Agenda: shared logistics, winter mutual-aid planning, and proposals for two more neighborhoods joining the federation. Afterparty with Bram's cider.",
    endorsements: ["The 903", "ONA"],
    rsvps: [3, 17, 8, 13, 15, 19, 9, 12, 20, 7],
  },
  {
    id: "e8",
    title: "The 903 Neighborhood Council Meeting",
    kind: "meeting",
    orgId: "the-903-council",
    host: { type: "member", id: 15 },
    date: dayFromNow(2), start: "18:30", end: "20:30",
    location: "The 903 community room",
    description: "Monthly meeting for The 903. Proposed agenda: the community-room repair budget, the new compost rota, and whether to back PVD Things' expansion. Bring items for the open floor.",
    votes: [15, 8, 5, 17, 4, 1, 2, 7, 11, 18],
    rsvps: [15, 8, 5, 17, 4, 1, 2, 7, 11, 18],
  },
  {
    id: "e9",
    title: "ONA Neighborhood Council Meeting",
    kind: "meeting",
    orgId: "ona-council",
    host: { type: "member", id: 13 },
    date: dayFromNow(6), start: "17:00", end: "19:00",
    location: "Olneyville Community Garden shed",
    description: "Monthly meeting for ONA residents. Proposed agenda: garden plot assignments for fall, the shared-tool storage build, and a block-party date. Open floor at the end.",
    votes: [13, 6],
    rsvps: [13, 6],
  },
  {
    id: "e7",
    title: "Risograph Zine Night",
    host: { type: "member", id: 13 },
    date: dayFromNow(5), start: "19:00", end: "22:00",
    location: "ONA print room",
    description: "Make a one-page zine start to finish: layout, two-color riso, fold, and bind. Paper and ink provided. Bring a drawing, a poem, a recipe, a rant — whatever wants to be printed.",
    rsvps: [13, 20, 6, 9],
  },
  {
    id: "e11",
    title: "The 903 Neighborhood Council Meeting",
    kind: "meeting",
    orgId: "the-903-council",
    host: { type: "member", id: 15 },
    date: dayFromNow(-26), start: "18:30", end: "20:30",
    location: "The 903 community room",
    description: "Last month's meeting. Agenda covered the spring tool-library budget, the mural permission letter, and electing two new delegates for the federation council.",
    votes: [15, 8, 5, 17, 4, 1, 11, 2, 7, 10],
    rsvps: [15, 8, 5, 17, 4, 1, 11, 2, 7, 10],
  },
];

/* deterministic avatar per member — neutral silhouettes, seeded */
export function avatarFor(m) {
  return `https://i.pravatar.cc/300?img=${m.id + 8}`;
}
export function memberById(id) {
  return MEMBERS.find((m) => m.id === id);
}
export function orgById(id) {
  return ORGS.find((o) => o.id === id);
}

/* resolve an event host to a display name + opener target */
export function hostInfo(host) {
  if (host.type === "org") {
    const o = orgById(host.id);
    return { label: o.name, kind: o.kind, avatar: null, org: o, member: null };
  }
  const m = memberById(host.id);
  return { label: m.name, kind: m.role, avatar: avatarFor(m), org: null, member: m };
}
