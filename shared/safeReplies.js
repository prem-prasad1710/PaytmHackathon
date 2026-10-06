/**
 * Counter-scam safe reply suggester — copy-only, never auto-send.
 */

const HELPLINE = {
  phone: "1930",
  url: "https://www.cybercrime.gov.in/",
  label: "Report on cybercrime.gov.in / call 1930",
};

export function suggestSafeReplies(result = {}, text = "") {
  const risk = result.risk || "";
  if (!String(risk).toLowerCase().includes("high")) {
    return { show: false, replies: [], helpline: HELPLINE };
  }

  const playbookId = result.playbook?.playbookId || "";
  const coaching = Boolean(result.coercion?.coachingSuspected);

  const replies = [
    {
      id: "refuse",
      title: "Polite refusal",
      text: "Sorry, I won't send any money or share OTP/PIN. Please use the official app/bank channel only.",
      textHi: "Sorry, main paise / OTP / PIN nahi bhejunga. Sirf official app ya bank se baat karein.",
    },
    {
      id: "verify_branch",
      title: "Verify at branch / saved number",
      text: "I will verify this at my bank branch / by calling the number saved in my phone. Do not call me again for payment.",
      textHi: "Main apne bank branch / saved number pe verify karke hi aage badhunga. Payment ke liye dubara call mat karna.",
    },
    {
      id: "report",
      title: "I am reporting this",
      text: "This looks like a scam. I am reporting it on cybercrime.gov.in and calling 1930. Do not contact me again.",
      textHi: "Ye scam lagta hai. Main cybercrime.gov.in pe report kar raha hoon aur 1930 pe call. Dobara contact mat karna.",
    },
  ];

  if (coaching || playbookId === "digital_arrest") {
    replies[0] = {
      id: "hangup",
      title: "Hang up / quit remote app",
      text: "I am hanging up and closing AnyDesk/TeamViewer. I will only talk through the official cybercrime helpline 1930.",
      textHi: "Main call kaat raha hoon aur AnyDesk/TeamViewer band. Sirf 1930 official helpline se baat karunga.",
    };
  }
  if (playbookId === "fake_kyc" || /kyc/i.test(text)) {
    replies[1] = {
      id: "official_kyc",
      title: "Official KYC only",
      text: "I update KYC only inside the official Paytm / bank app. I will not click links or pay ₹1 to verify.",
      textHi: "KYC main sirf official Paytm/bank app me karta hoon. Link/₹1 verify nahi karunga.",
    };
  }

  return {
    show: true,
    replies: replies.slice(0, 3),
    helpline: HELPLINE,
    note: "Copy-only suggestions. Shield never sends messages for you.",
  };
}
