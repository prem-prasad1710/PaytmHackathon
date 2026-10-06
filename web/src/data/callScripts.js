export const CALL_SCRIPTS = [
  {
    id: "digital-arrest",
    title: "Digital arrest scam",
    description: "CBI/police impersonator with video-call intimidation",
    lines: [
      { text: "Good afternoon, this is Inspector Sharma from CBI cyber cell Delhi.", delay: 2200 },
      { text: "Your Aadhaar is linked to a money laundering case.", delay: 2800 },
      { text: "A digital arrest warrant has been issued against you.", delay: 2600 },
      { text: "Do not disconnect — stay on this video call right now.", delay: 2400 },
      { text: "Do not tell anyone, especially your family.", delay: 2000 },
      { text: "Transfer all funds to the RBI safe account for verification.", delay: 3000 },
      { text: "If you do not comply, police will come to your home today.", delay: 2800 },
    ],
  },
  {
    id: "fake-kyc",
    title: "Fake bank KYC",
    description: "Caller claims to be bank manager about expired KYC",
    lines: [
      { text: "Hello, I am calling from your bank, branch manager here.", delay: 2000 },
      { text: "Your KYC has expired and your account will be blocked today.", delay: 2600 },
      { text: "This is urgent, you must update immediately.", delay: 2200 },
      { text: "Please install AnyDesk so I can help you update KYC.", delay: 2800 },
      { text: "Share the OTP that comes to your phone.", delay: 2400 },
      { text: "Also tell me your debit card number and CVV for verification.", delay: 2800 },
    ],
  },
  {
    id: "electricity",
    title: "Electricity disconnection",
    description: "Threatens power cut and demands immediate payment",
    lines: [
      { text: "This is from the electricity department.", delay: 1800 },
      { text: "Your connection will be disconnected within two hours.", delay: 2400 },
      { text: "Pay the pending amount immediately to avoid disconnection.", delay: 2600 },
      { text: "Click the link I am sending to pay now.", delay: 2200 },
      { text: "Do not tell anyone, this is a confidential matter.", delay: 2000 },
    ],
  },
  {
    id: "genuine-delivery",
    title: "Genuine delivery call",
    description: "Normal courier confirmation — should stay low risk",
    lines: [
      { text: "Hello, I am calling from Delhivery courier.", delay: 2000 },
      { text: "We have a package for you. Are you available to receive it?", delay: 2400 },
      { text: "Can you confirm your delivery address is correct?", delay: 2200 },
      { text: "The delivery will arrive between 2 PM and 5 PM today.", delay: 2400 },
      { text: "Thank you, have a good day.", delay: 1800 },
    ],
  },
];
