import { createInsightSchema } from "@atlas/shared";

// Stable IDs keep reruns additive, even after demo content is edited.
export const demoId = (kind: "author" | "insight", index: number) =>
  `a71a5de0-${kind === "author" ? "0001" : "0002"}-4000-8000-${String(index + 1).padStart(12, "0")}`;

export const DEMO_AUTHORS = [
  "Maya Chen",
  "Leo Santos",
  "Aisha Rahman",
  "Sofia Rossi",
  "Daniel Park",
  "Amara Okafor",
  "Nico Alvarez",
  "Hana Suzuki",
  "Ishan Patel",
  "Lina Haddad",
  "Eva Novak",
  "Mateo Silva",
].map((displayName, index) => ({
  id: demoId("author", index),
  displayName,
  email: `atlas-demo-${index + 1}@walkthrough.invalid`,
  cohort: `M${27 + (index % 4)}`,
}));

type Tip = [
  title: string | null,
  categories: string,
  body: string,
  sourceUrl?: string,
];
const sf: Tip[] = [
  [
    "A grocery loop that fits between classes",
    "food,shopping",
    "I keep a shared grocery list with my roommates and group errands into one walk. Start with pantry basics, then pick vegetables for two meals rather than planning a whole week. Carry a tote: the walk home feels longer with loose bags.",
  ],
  [
    "Finding study spots without buying another coffee",
    "study-work",
    "The public library became my backup when our room was noisy. Check branch hours before leaving, bring headphones, and download your readings first. I scout a seat and an outlet before unpacking everything.",
    "https://sfpl.org/",
  ],
  [
    "Packing for a sunny morning and a windy evening",
    "living,travel",
    "My most-used item in San Francisco is a light layer that fits in my backpack. I pack for the trip home, not just the weather outside when I leave. A small reusable bag helps when an afternoon errand turns into groceries.",
  ],
  [
    "Try your commute before the first busy day",
    "transportation",
    "I walked my route once without a deadline and saved a transit alternative. That made it easier to judge hills, crossings, and how much buffer I needed. For live service changes I check the transit operator rather than an old screenshot.",
    "https://www.sfmta.com/",
  ],
  [
    "Cook once, trade leftovers",
    "food,living",
    "Two friends and I each cook something different and trade a portion. We label containers with ingredients and the cooking date. It gives us variety without everyone spending the evening in the kitchen.",
  ],
  [
    null,
    "health-fitness,activities",
    "A short walk before opening my laptop helps me reset after class. I choose a familiar route while it is still light and leave my phone in my pocket for part of it. Having a friend join makes it easier to actually go.",
  ],
  [
    "A weekend with no ambitious itinerary",
    "activities,travel",
    "Pick one neighborhood, one meal, and one thing you want to see. Leave the rest of the afternoon open. My favorite days here have been the ones where we had time to sit somewhere instead of racing to the next stop.",
  ],
  [
    "Secondhand shopping: measure first",
    "shopping,living",
    "Before looking for room supplies, measure the space and take a photo of the dimensions. I bring a tape measure and think about how to carry the item home. A cheap shelf is less useful if it cannot fit through the door.",
  ],
  [
    "Make a quiet-hour agreement early",
    "living,study-work",
    "We wrote down when each roommate usually has calls and when we prefer quiet. It is easier to adjust a specific agreement than to guess whether someone is annoyed. We revisit it when class schedules change.",
  ],
  [
    "A rainy-day study kit",
    "study-work",
    "I leave a charger, headphones, and a small notebook together in one pouch. On rainy days I can switch study spots without searching the room for cables. Downloading readings also helps when the connection is unreliable.",
  ],
  [
    "The snack that saves my afternoon",
    "food",
    "I keep something filling in my bag on days with back-to-back plans. A snack and a water bottle make it easier to decide what I actually want for dinner instead of buying the first thing I see.",
  ],
  [
    "Plan the return trip too",
    "transportation,activities",
    "Before an evening outing, I check how we will get back and agree on a meeting point if we split up. I save the address separately from the group chat so I can find it quickly.",
  ],
  [
    "Start running with a conversation pace",
    "health-fitness",
    "Our informal running group has a simple rule: the first loop is easy enough to talk. People can add distance afterward. It makes joining feel less intimidating when you are still settling into the city.",
  ],
  [
    "Take a library afternoon with a friend",
    "activities,study-work",
    "We each bring a different task, work quietly for a while, and then take a break together. It feels social without turning the entire study block into a conversation.",
  ],
  [
    "Keep a room repair note",
    "living",
    "Write down what is broken, when you noticed it, and any follow-up you have already made. Photos help you explain the issue clearly. Use the appropriate housing channel rather than assuming a message in a student chat will reach the right person.",
  ],
  [
    "Check a museum's own calendar",
    "activities",
    "I look at the museum website before choosing a day. Exhibitions, reservations, and opening hours can change. Agree on one exhibit to start with so a group visit does not begin with everyone wandering in different directions.",
  ],
  [
    "A small grocery budget experiment",
    "shopping,food",
    "For one week I wrote down what I actually finished eating. The useful discovery was how much I bought with good intentions and then ignored. Now I shop around meals I know I will make when tired.",
  ],
  [
    "Save an offline meeting point",
    "travel,transportation",
    "When friends visit, I send a clear meeting point and an offline screenshot of the surrounding streets. We also agree on what to do if someone loses connection. It saves a lot of messages on arrival day.",
  ],
  [
    "Do a weekly backpack reset",
    "living",
    "Every Sunday I remove receipts, refill the small essentials pouch, and check that my charger is back in the bag. It takes a few minutes and prevents the Monday search for something I used over the weekend.",
  ],
  [
    "Stretch between reading blocks",
    "health-fitness,study-work",
    "I set a gentle reminder to stand up after a reading block. A short stretch and a refill of water help me notice when I have been staring at the same paragraph for too long.",
  ],
  [
    "Give group projects a closing ritual",
    "study-work",
    "Before leaving a group meeting, each person says what they will deliver and when. We write it in one shared note. That final minute has prevented more confusion than another hour of discussion.",
  ],
  [
    "Bring one shared picnic item",
    "food,activities",
    "For a casual picnic, ask everyone to bring one thing and post it in the chat. Include water and something to sit on in the list. A plan for carrying leftovers is surprisingly helpful.",
  ],
  [
    "Leave space after a weekend trip",
    "travel",
    "I avoid filling the entire evening after returning with errands and coursework. Unpacking, laundry, and a simple meal make Monday feel much less rushed.",
  ],
  [
    null,
    "transportation",
    "I save frequently used destinations with the entrance I actually need, not just the building pin. It is especially useful when I am meeting someone and the block has several doors.",
  ],
];
const tokyo: Tip[] = [
  [
    "A grocery notebook for your first week",
    "food,shopping",
    "I keep photos of groceries I liked and the labels I need to recognize. It is much faster than translating the same package on every trip. Start with a small basket while you learn what fits your kitchen routine.",
  ],
  [
    "Study spots: scout before a deadline",
    "study-work",
    "Try a potential study spot on a low-pressure afternoon. Check the noise, seating rules, and whether you can comfortably read for an hour. I keep two alternatives so a full room does not ruin my plan.",
  ],
  [
    "Packing a compact day bag",
    "travel,living",
    "A small towel, water bottle, portable charger, and room for an extra layer cover most of my day. I leave a little empty space for groceries rather than carrying a second bag everywhere.",
  ],
  [
    "Save the station exit",
    "transportation",
    "When meeting friends, we share the station name and a specific exit. The first time, I leave extra time to find the signs and get oriented above ground. A screenshot is useful when reception drops.",
  ],
  [
    "Build a breakfast you can repeat",
    "food",
    "I found a simple breakfast I could prepare without much thought, then varied the fruit or toppings. Having one reliable meal makes busy mornings easier while I am still exploring other food options.",
  ],
  [
    "Practice a small shopping phrase list",
    "shopping",
    "Keep a few useful phrases in a note you can open quickly. I include how to ask about a bag and how to politely say I do not understand. Practicing with a friend makes it less awkward to try.",
  ],
  [
    "A low-key neighborhood afternoon",
    "activities",
    "Choose a walkable area and leave time to stop when something catches your attention. I take a photo of where we started so finding the way back does not become the main activity.",
  ],
  [
    null,
    "living",
    "Our shared room works better with a visible checklist for supplies. Whoever finishes something adds it immediately. We decide who is shopping before anyone leaves, which avoids bringing home three replacements.",
  ],
  [
    "Check the last connection before dinner",
    "transportation,activities",
    "For an evening across town, I look up the return journey while I still have a connection. We agree on when to leave and a backup plan before dinner turns into a long conversation.",
  ],
  [
    "Walk first, track later",
    "health-fitness",
    "During the first week I focused on a comfortable daily walk rather than a new training schedule. It helped me learn the neighborhood and notice when I needed more rest.",
  ],
  [
    "Keep a travel document pouch",
    "travel",
    "I keep the documents I may need together and store secure backups separately. Before a trip, I check the current requirements with the relevant official source rather than relying on a classmate's old checklist.",
  ],
  [
    "A quiet coworking pact",
    "study-work",
    "Two of us meet with a clear task and work silently until a planned break. We share progress at the end. It is a useful middle ground between studying alone and a social afternoon.",
  ],
  [
    "Try one new ingredient at a time",
    "food,shopping",
    "I pair a new ingredient with a meal I already know how to cook. That way dinner is still manageable if I need to look something up. Take a photo of the package if you want to buy it again.",
  ],
  [
    "Plan laundry around your actual week",
    "living",
    "I found a regular laundry window and keep a spare bag for clothes that need special care. Check the instructions on the machine you are using; a friend's routine may not match yours.",
  ],
  [
    "A stretch break after long journeys",
    "health-fitness,travel",
    "After a long day in transit, I unpack the essentials, drink water, and take a gentle walk if I feel up to it. I try to leave demanding plans for after I have slept.",
  ],
  [
    "Keep a list of rainy-day ideas",
    "activities",
    "Our group keeps a short list of indoor things we would like to try. When the weather changes, we can pick one without spending the afternoon debating in the chat.",
  ],
];
const ba: Tip[] = [
  [
    "Groceries with a meal buddy",
    "food,shopping",
    "A friend and I plan two dinners before buying groceries. We split ingredients we can both use and keep the rest of the week flexible. It makes shopping feel less like guessing.",
  ],
  [
    "Find study spots at different times",
    "study-work",
    "A place that is quiet in the morning can feel completely different later. I try a short reading session before committing to a big project there. Keep a backup location and your files available offline.",
  ],
  [
    "Packing for small everyday errands",
    "living,travel",
    "I carry a reusable bag and keep the day's essentials in a compact pouch. Before leaving, I check the weather and how I will get back. I have stopped packing for every possible scenario.",
  ],
  [
    "Learn the route while you have time",
    "transportation",
    "I test a new route on a day when being a little late does not matter. Save the destination and a return option before leaving. Check current local transit guidance for tickets and service changes.",
  ],
  [
    "Make dinner a language practice night",
    "food,activities",
    "We choose a simple meal and practice a few cooking words together. Everyone can ask questions without feeling put on the spot. The meal matters more than getting every sentence right.",
  ],
  [
    "A room reset before the week begins",
    "living",
    "We spend a short block clearing shared surfaces and deciding what needs replacing. Each person takes one task. It is easier to maintain than waiting for a huge cleaning day.",
  ],
  [
    "Try a beginner-friendly activity together",
    "activities,health-fitness",
    "Ask about the level and what to bring before joining a new class or group. Going with someone else makes the first visit easier. Leave yourself permission to try something different next time.",
  ],
  [
    "Keep a note of store hours",
    "shopping",
    "I write down the hours of the shops I actually use, then recheck before a special trip. Combining nearby errands saves more time than making an ambitious shopping list.",
  ],
  [
    "Give a weekend trip one anchor",
    "travel",
    "Choose one activity that matters most and build a loose day around it. Check current booking and transport details directly. Leaving open time makes delays easier to handle.",
  ],
  [
    null,
    "health-fitness",
    "My easiest exercise routine is a walk with a friend after a study block. We keep the route simple and adjust the length to how we feel that day. Consistency matters more to me than making every outing a workout.",
  ],
  [
    "Write the next step before closing your laptop",
    "study-work",
    "At the end of a study session I leave one sentence about what to do next. Coming back to a clear task is much easier than rereading every tab to remember where I was.",
  ],
  [
    "Share the meeting point in plain text",
    "transportation,activities",
    "Send the address and a recognizable meeting point instead of only a map link. We agree on a fallback time and place if someone cannot get online. It is a small habit that keeps group outings relaxed.",
  ],
];
const general: Tip[] = [
  [
    "Packing: the first-night pouch",
    "travel,living",
    "Keep a change of clothes, your charger, and the essentials you need on arrival together. After a long journey I want to settle in without opening every bag. Check current travel rules before packing anything restricted.",
  ],
  [
    "A shared groceries list that people use",
    "food,shopping",
    "Our groceries list has three sections: needed now, next shop, and nice to have. We put our names next to personal items. A quick check before leaving prevents duplicate purchases.",
  ],
  [
    "How I compare study spots in a new city",
    "study-work",
    "I look for a comfortable seat, a workable noise level, and clear rules about staying. Try a short session first and keep a second option. A good study spot is one where I can actually finish a task, not just take a nice photo.",
  ],
  [
    "Unpack a routine before unpacking everything",
    "living,health-fitness",
    "On arrival I set up my sleeping space and find a simple meal before organizing the whole room. A little rest makes the remaining decisions easier. I give myself a few days to settle into a new rhythm.",
  ],
  [
    "Agree on the outing budget first",
    "activities,shopping",
    "Before making a group plan, ask what everyone is comfortable spending and whether they want a shorter option. It is easier to choose something together when nobody has to explain themselves at the last minute.",
  ],
  [
    null,
    "transportation,travel",
    "I keep an offline note with my accommodation address, arrival instructions, and a backup meeting point. It is useful when a battery dies or an airport connection does not cooperate.",
  ],
  [
    "Keep useful advice outside the group chat",
    "study-work,living",
    "When someone shares a tip I know I will need later, I save it with a short description and where it came from. I also note when I should recheck it. Searching a clear title beats scrolling through weeks of messages.",
  ],
  [
    "Plan a welcome meal with an easy exit",
    "food,activities",
    "For a first group meal, keep the plan simple and tell people they can drop in briefly. Travel days and new schedules can be tiring. There will be plenty of time for a longer evening later.",
  ],
];

export const DEMO_INSIGHTS = [
  ...sf.map((tip) => ({ tip, city: "san-francisco" })),
  ...tokyo.map((tip) => ({ tip, city: "tokyo" })),
  ...ba.map((tip) => ({ tip, city: "buenos-aires" })),
  ...general.map((tip) => ({ tip, city: "general" })),
].map(({ tip: [title, categories, body, sourceUrl], city }, index) => ({
  id: demoId("insight", index),
  // Two owner contributions per city and General.
  owned: [0, 2, 24, 26, 40, 42, 52, 54].includes(index),
  authorIndex: index % DEMO_AUTHORS.length,
  voteCount: (index * 7 + 3) % 13,
  ageHours: 2 + ((index * 23) % (56 * 24 - 2)),
  input: createInsightSchema.parse({
    title,
    body,
    sourceUrl: sourceUrl ?? null,
    categorySlugs: categories.split(","),
    citySlugs: city === "general" ? [] : [city],
  }),
}));
