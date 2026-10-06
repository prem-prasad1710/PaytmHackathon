"""Synthetic English / Hinglish scam + legitimate message generator.

Every sample is rendered from a numbered template, so the train/test split in
train.py is done *by template* (not by sample). That measures generalisation to
unseen wording instead of memorised phrases.
"""
from __future__ import annotations

import random

SLOTS = {
    "amt": ["1", "10", "499", "999", "2,000", "5000", "9,999", "15,000", "25000", "49,500"],
    "bank": ["SBI", "HDFC", "ICICI", "Axis", "PNB", "Kotak", "Paytm Payments Bank"],
    "link": [
        "bit.ly/kyc-now", "tinyurl.com/upd8", "paytm-kyc-verify.in/login", "sbi-secure.xyz/auth",
        "rb.gy/claim9", "http://pay-tm.support/verify", "cutt.ly/refund", "wa.me/91981234xxxx",
    ],
    "upi": ["help.desk@oksbi", "refund.claim@ybl", "support9981@paytm", "rewards.team@okaxis", "cashback.paytm@icici"],
    "luser": [
        "rohit.verma@okaxis", "priya.nair@oksbi", "amit9812@ybl", "sneha.k@okhdfcbank", "vikram.s@paytm",
        "rahul.sharma@oksbi", "neha.gupta@okicici", "arjun.m@ibl", "kavita1987@ybl", "deepak.r@axl",
        "mom.home@okaxis", "papa.savings@ybl", "dadi.pension@oksbi", "didi.k@okhdfcbank", "9811122233@paytm",
    ],
    "phone": ["9876543210", "8877665544", "7012345678", "9123456780"],
    "item": ["sofa", "iPhone 13", "bike", "fridge", "PS5", "AC", "laptop"],
    "name": ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Neha", "Rohit"],
    "agency": ["CBI", "Mumbai Police", "Cyber Cell", "Customs", "TRAI", "Narcotics Bureau"],
    "biller": ["Tata Power", "BSES", "Airtel", "Jio", "MSEDCL", "Indane Gas"],
    "shop": ["Sharma Sweets", "Raj Kirana", "Cafe Mocha", "Metro Mart", "City Pharmacy"],
    "n": ["2", "3", "6", "12", "24", "48"],
}

# label -> list of templates
SCAM_TEMPLATES: dict[str, list[str]] = {
    "kyc_phishing": [
        "Dear customer your {bank} KYC is pending. Account will be blocked in {n} hours. Update now {link}",
        "Aapka Paytm KYC expire ho gaya hai. Turant verify karein {link} warna wallet band ho jayega",
        "URGENT: {bank} account suspended. Complete KYC at {link} and enter your UPI PIN to reactivate",
        "Your PAN card is not linked, account will be freezed today. Click {link} to update details",
        "KYC update karne ke liye Rs {amt} bhejein is link par {link} aur apna card number daalein",
        "Paytm: wallet limit exceeded. Verify identity within {n} hrs {link} or balance will be forfeited",
        "Dear user, your {bank} netbanking will be deactivated. Update Aadhaar & PAN: {link}",
        "Aapka account block hone wala hai. KYC verification ke liye {phone} par call karein ya {link} kholein",
    ],
    "qr_scam": [
        "Scan this QR code to receive Rs {amt} in your account. Enter your UPI PIN to accept the payment",
        "Maine payment bhej diya hai, QR scan karo aur PIN daalo paise aa jayenge ₹{amt}",
        "To get your cashback of Rs {amt} scan the attached QR and approve the request",
        "Buyer here. I am sending advance for the {item}, scan this QR to receive money and put PIN",
        "QR code scan karke refund receive karein. Agar paisa na aaye to dobara scan karein aur PIN dalein",
        "Your deposit of Rs {amt} is ready. Scan QR, tap collect/approve and money will be credited instantly",
        "Sir QR scan kijiye, aapko ₹{amt} milega. Bas PIN daalna hai confirm karne ke liye",
        "Scan the QR to claim reward Rs {amt}. Approve the UPI request from {upi} to receive",
    ],
    "lottery_prize": [
        "Congratulations! You won Rs 25,00,000 in KBC lucky draw. Pay processing fee Rs {amt} to {upi} to claim",
        "Aapne lottery jeeti hai! Prize claim karne ke liye Rs {amt} registration fee bhejein {upi}",
        "You are selected for iPhone 15 giveaway. Pay delivery charges Rs {amt} via UPI {upi}",
        "WINNER! Lucky customer Rs {amt} cashback unlocked. Click {link} and send small fee to receive",
        "Badhai ho! Aapka number lucky draw me select hua hai. Tax ke liye Rs {amt} jama karein",
        "Jio anniversary reward: you won 5 lakh. Contact {phone} and pay claim charges Rs {amt}",
    ],
    "refund_scam": [
        "Your order refund of Rs {amt} is pending. Share your UPI PIN / OTP to receive the refund",
        "Refund process karne ke liye hum aapko request bhej rahe hain, approve kar dijiye {upi}",
        "Excess amount debited by mistake. Please send Rs {amt} back to {upi}, I sent to wrong number",
        "Galti se aapke account me Rs {amt} chale gaye. Wapas bhej do {upi} please bahut zaroori hai",
        "Electricity refund: click {link}, enter card details & OTP to get Rs {amt} refunded",
        "Cashback reversal failed. Install the support app and share the code to get Rs {amt} back",
    ],
    "otp_pin_theft": [
        "Hello this is {bank} bank manager. Share the OTP you just received to stop unauthorised transaction",
        "Sir aapke card par fraud ho raha hai, abhi OTP aur CVV batao warna account block",
        "Your UPI PIN is required to verify. Please reply with 6 digit PIN and OTP immediately",
        "Customer care here. Tell me the 6 digit code sent on your phone to cancel the order of Rs {amt}",
        "OTP bata dijiye {name} ji, aapka loan approve ho gaya hai bas OTP chahiye verification ke liye",
        "Card expire ho gaya hai. Naya card activate karne ke liye CVV, expiry aur OTP share karein",
    ],
    "job_fee_scam": [
        "Work from home job! Earn Rs 3000 daily. Pay registration fee Rs {amt} to {upi} to start",
        "Part time job offer Amazon reviews. Deposit Rs {amt} security to get task, telegram {phone}",
        "Aapko job mil gayi hai. Joining ke liye training fee Rs {amt} bhejein {upi} aaj hi",
        "Typing job, no experience. Send Rs {amt} for ID card & kit, salary 40000/month guaranteed",
        "Like YouTube videos and earn. First recharge Rs {amt} to unlock higher commission tasks",
        "Government naukri pakki! Form fees Rs {amt} abhi {upi} par bhejein, seat limited hai",
    ],
    "impersonation_police": [
        "This is {agency}. A parcel in your name contains illegal items. Pay Rs {amt} fine now or you will be arrested",
        "Digital arrest: you are under investigation. Stay on video call and transfer Rs {amt} to safe account",
        "Aapke Aadhaar se illegal activity hui hai. {agency} officer {phone} par turant call karein warna arrest",
        "Your SIM will be disconnected in {n} hours by TRAI. Press 9 to talk to officer, verification fee Rs {amt}",
        "{agency} notice: money laundering case against you. Do not tell anyone, deposit Rs {amt} for clearance",
        "Aapke naam par courier me drugs mile hain. Case band karne ke liye Rs {amt} transfer karein abhi",
    ],
    "emergency_family": [
        "Papa main {name} hoon, naye number se. Phone gir gaya, accident ho gaya, turant Rs {amt} bhejo {upi}",
        "Hi mom this is my new number, I am stuck in hospital need Rs {amt} urgently, send to {upi}, dont call",
        "Bhai emergency hai, phone chori ho gaya. Is UPI par {amt} bhej do baad me return kar dunga {upi}",
        "Beta I am in trouble police station, please transfer Rs {amt} right now, don't tell anyone",
        "Mummy phone kharab ho gaya, ye mera naya number hai. Abhi Rs {amt} bhejo {luser} pe, urgent hai, kisi ko mat batana",
        "Uncle urgent medical help needed Rs {amt}. New number. Please pay {upi} quickly will explain later",
    ],
    "remote_access": [
        "To fix payment failure install AnyDesk or TeamViewer and share the 9 digit code with our executive",
        "Aapka refund process karne ke liye QuickSupport app download karke code batayein",
        "Download this support app from {link}, open it and give us the access code to cancel your order",
        "Screen sharing app install karo aur code do, hum aapka account sync kar denge {link}",
    ],
    "marketplace_advance": [
        "I am interested in your {item}. I am army officer, will pay advance. Send Rs {amt} first for delivery charges",
        "Aapka {item} lena hai. Pehle Rs {amt} bhej do token ke liye, phir main aake le jaunga {upi}",
        "OLX buyer: I will send money by QR. Please scan and enter PIN to receive for the {item}",
        "Rent advance chahiye? Pay Rs {amt} booking token via {upi}, owner abroad, keys by courier",
        "Pay Rs 1 to verify your account and receive payment for the {item}, send screenshot",
        "Interested in the {item}. Send Rs {amt} to {luser} as booking token right now, many buyers waiting",
    ],
    "fake_customer_care": [
        "For {bank} complaint call customer care {phone} 24x7. Refund Rs {amt} in 5 mins",
        "Paytm helpline number {phone} par call karein. Wallet issue turant solve hoga, pehle app download karein",
        "Gas subsidy pending. Call {phone}, officer will help, keep your card and OTP ready",
        "Google search se customer care number mila? Call {phone} to cancel transaction of Rs {amt}",
    ],
    "electricity_disconnect": [
        "Dear consumer your electricity will be disconnected tonight 9:30 pm due to unpaid bill. Call {phone} now",
        "Bijli connection aaj raat kat jayega. Bill update karne ke liye {link} par Rs {amt} bhejein",
        "{biller} alert: last bill not paid, connection cut in {n} hours. Pay via {upi} to avoid disconnection",
        "Aapka {biller} bill pending hai, turant {phone} par officer se baat karein warna meter hata diya jayega",
    ],
}

LEGIT_TEMPLATES: list[str] = [
    "Your electricity bill of Rs {amt} is due on 15th. Pay on the official {biller} app or website",
    "Rs {amt} debited from a/c XX1234 on UPI to {shop}. Ref no 3341{n}. If not you, call bank helpline",
    "OTP for your transaction is 482913. Do not share this OTP with anyone. {bank} never asks for OTP",
    "Aapka {biller} bill Rs {amt} generate ho gaya hai. Due date 20th. Paytm app me bill pay karein",
    "Hey {name}, dinner at 8? I will pay for the cab, you get the snacks",
    "Rs {amt} credited to your account from {name} via UPI. Available balance Rs 12,430",
    "Paytm: your payment of Rs {amt} to {shop} was successful. Thank you for paying",
    "Reminder: your {biller} recharge expires in {n} days. Recharge from the official app to continue",
    "Bhai kal ka match dekha? Kya zabardast tha. Chai pe milte hain kal shaam ko",
    "Your {bank} credit card statement for this month is ready. Min due Rs {amt}. Pay via netbanking",
    "Mom i reached home safe. Dinner is ready, come soon. Also dont forget the milk",
    "Split the bill: you owe me Rs {amt} for lunch, send whenever you are free",
    "Hi {name}, meeting rescheduled to 4pm tomorrow. Please confirm your availability",
    "Order #8841 for {item} has been shipped. Track on the official app. Expected delivery {n} days",
    "Beta fees ka receipt mil gaya, Rs {amt} bhar diya hai school ko, tension mat lo",
    "{shop} invoice: total Rs {amt}. Thank you for shopping with us. Visit again",
    "Beware of frauds. Never share your UPI PIN or OTP with anyone, not even bank staff",
    "Aapka gas cylinder booking confirm ho gayi hai. Delivery {n} din me. Cash on delivery Rs {amt}",
    "Scan the QR displayed at {shop} counter to pay Rs {amt}. Show success screen to the cashier",
    "Your {bank} account statement is ready to download in the official app under Statements",
    "Reminder: prepaid plan renewal Rs {amt}. Pay anytime from the {biller} app. No action needed today",
    "Hi, I am selling my {item} for Rs {amt}. Come see it in person, payment on delivery only",
    "Your KYC is verified successfully. No further action is required. Thank you for banking with {bank}",
    "{bank}: your KYC is due next month. Visit the nearest branch with original documents or update in the official app",
    "Congratulations {name} on the new job! Party on Saturday, I will book the table, you bring the cake",
    "You have received Rs {amt} refund for order #7712 to your original payment method. It will reflect in {n} days",
    "Bhai Rs {amt} bhej diye maine tere account me, check kar lena. Kal wapas de dena jo bhi bacha ho",
    "Mummy ne bola hai ki bijli ka bill Rs {amt} bhar dena, receipt photo bhej dungi shaam ko",
    "Hello, this is a reminder from {shop}: your order is ready for pickup. Pay at the counter by cash or UPI",
    "Dear customer, your {bank} debit card ending 4421 was used for Rs {amt} at {shop}. Not you? Call the number printed on your card",
    "Team lunch bill: Rs {amt} per head. Please pay {name} on UPI when you get time, no hurry",
    "Weekly report attached. Let me know if anything needs a change before the review meeting tomorrow",
    "Interview scheduled for tomorrow 11am at our office. Please carry your resume and ID proof. No fees are charged by us",
    "Rent for this month Rs {amt} sent to your account. Please confirm receipt when you see it",
    "Your {biller} postpaid bill of Rs {amt} is generated. Pay online using the official app or at authorised centres",
    "Hi {name}, I am your neighbour, I paid Rs {amt} for the parcel you ordered, send it when you are free",
    "Alert: {bank} will never call you to ask for PIN, OTP or CVV. Report suspicious calls on 1930",
    "Payment of Rs {amt} to {shop} via QR scan was successful. Transaction ID 9981{n}. Keep this for your records",
    "Your {item} purchase receipt: Rs {amt}, 1 year warranty included. Keep this message for service",
    "Cab fare Rs {amt} paid to driver via UPI. Rate your ride. Have a nice day",
    "Please pay the school fee of Rs {amt} on the official school portal before the 10th. Late fee applies after",
    "Happy birthday {name}! Sending you love. Treat me when we meet, I will transfer a small gift on UPI",
    "Your policy premium of Rs {amt} is due. Pay through the official insurer app or auto debit, no calls from agents",
    "Cashback of Rs {amt} credited to your Paytm wallet for your last recharge. Valid on next bill payment",
    "Doctor appointment confirmed for tomorrow 5pm at City Clinic. Consultation fee Rs {amt} payable at clinic",
    "Aapke {biller} ka recharge safal raha. Plan valid {n} din ke liye. Dhanyavaad",
    "Bank holiday notice: branches remain closed on Sunday. UPI and netbanking services remain available",
    "Kal ki meeting ka agenda bhej diya hai mail par. Dekh lena aur kuch changes ho to batana",
    "We are hiring: apply on our official careers page. Selection is merit based and we never ask money from candidates",
    "Your grocery order of Rs {amt} is out for delivery. Pay cash or UPI to the delivery partner on arrival",
    "Aaj ka gold rate badh gaya hai. Agar lena hai to {shop} jaake dekh lo, wo fair rate dete hain",
    "Friend request: {name} sent you Rs {amt} on UPI for movie tickets. Open your UPI app to see the credit",
    "Please pay Rs {amt} to {luser} for the booking, I will send the confirmation once received",
    "Here is my UPI id {luser}, please send your share Rs {amt} for the trip whenever you can",
    "Advance of Rs {amt} to {luser} for the catering order. Balance on the day of the event",
    "Paid Rs {amt} to {luser}. Thanks for the quick delivery, please check and confirm",
    "Bhai Rs {amt} {luser} pe bhej dena, kal subah tak chalega, no hurry yaar",
    "Hi {name}, tuition fee for this month Rs {amt}, UPI {luser}. Thank you",
    "Rent Rs {amt} sent to {luser} for this month. Receipt attached in the mail",
    "Please call me on {phone} when you reach the station, I will pick you up. Pay the driver Rs {amt}",
    "Your Paytm statement is ready. Open paytm.com or the official app and go to Passbook to view it",
    "Pay your {biller} bill from the official website or the Paytm app. Do not pay through links in SMS",
    "Hi, can you send the Rs {amt} for the {item} to {luser}? I will collect it tomorrow evening",
    "Salary of Rs {amt} credited. Your HR team will share the payslip on the official portal",
    "Mummy ko Rs {amt} bhejna hai unke saved UPI {luser} pe. Note: monthly help",
    "Papa ko Rs {amt} bhej diya {luser} pe, ghar ka kharcha. Mil jaye to bata dena",
    "Monthly help for grandma Rs {amt}, sending to her saved UPI {luser}. Call her once it reaches",
    "Sending Rs {amt} to {luser} for mom's medicines, the same account I always use",
    "Didi ko Rs {amt} transfer karna hai {luser} pe, rakhi ka gift. Kal tak pahunch jayega",
    "Dad's pocket money Rs {amt} sent to {luser}. Please confirm once you see it",
    "Pay the maid Rs {amt} on {luser}, her salary for this month. She is on leave tomorrow",
    "Help me split the cab: Rs {amt} to {luser}, I already paid the driver",
    "Hostel mess fee Rs {amt} paid to {luser}. Warden will confirm the receipt on Monday",
    "Tiffin service monthly Rs {amt} to {luser}, same as last month. Thanks for the good food",
    "Bhaiya Rs {amt} {luser} pe bhej diye, doodh ka hisaab. Check kar lena",
    "Please send the Rs {amt} to {luser}, it's my brother's account, he will pick up the parcel",
    "Society maintenance Rs {amt} paid to {luser} treasurer, receipt will be mailed",
    "Gift for the wedding Rs {amt} sent on {luser}. Congratulations to the couple",
    "I will pay the plumber Rs {amt} on {luser} after the work is done tomorrow",
    "Aaj ka kirana Rs {amt} {luser} pe bhej dena, kal subah tak, koi jaldi nahi",
    "Chit fund instalment Rs {amt} sent to {luser} today. Please update the register",
    "Reminder: tuition fees Rs {amt} to {luser} before the 5th. Sir said no late fee till then",
]

NOISE_PREFIX = ["", "", "", "FWD: ", "Fwd: ", "Imp: ", "Sir, ", "Hello, ", "Hi {name}, "]
NOISE_SUFFIX = ["", "", "", " Thanks", " Reply fast", " !!", " 🙏", " Act now", " Regards"]


def _fill(template: str, rng: random.Random) -> str:
    out = template
    for key, options in SLOTS.items():
        token = "{" + key + "}"
        while token in out:
            out = out.replace(token, rng.choice(options), 1)
    return out


def _noise(text: str, rng: random.Random) -> str:
    text = _fill(rng.choice(NOISE_PREFIX), rng) + text + rng.choice(NOISE_SUFFIX)
    if rng.random() < 0.2:
        text = text.upper() if rng.random() < 0.3 else text.lower()
    if rng.random() < 0.12:
        i = rng.randrange(len(text))
        text = text[:i] + text[i + 1 :]
    return text


def build_templates() -> list[dict]:
    """Flat template list: id, label (category or 'legit'), text."""
    rows: list[dict] = []
    tid = 0
    for category, templates in SCAM_TEMPLATES.items():
        for t in templates:
            rows.append({"tid": tid, "category": category, "scam": 1, "template": t})
            tid += 1
    for t in LEGIT_TEMPLATES:
        rows.append({"tid": tid, "category": "legit", "scam": 0, "template": t})
        tid += 1
    return rows


def render(rows: list[dict], per_template: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    out: list[dict] = []
    for row in rows:
        per = per_template * (2 if row["scam"] == 0 else 1)
        for _ in range(per):
            text = _noise(_fill(row["template"], rng), rng)
            out.append({"text": text, "category": row["category"], "scam": row["scam"], "tid": row["tid"]})
    rng.shuffle(out)
    return out
