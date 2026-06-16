"""
Minimal moderation CLI — the pre-launch bridge until a real admin dashboard exists.

Usage:
  python moderate.py reports            # list open reports (reason + who/what)
  python moderate.py ban <email>        # suspend an account
  python moderate.py unban <email>      # restore an account
  python moderate.py resolve <report_id>  # mark a report handled

Banning sets is_banned=True on the user: they can no longer log in, their token
is rejected on every request, and their posts + profile are hidden from others.
Fully reversible with `unban`.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).parent / ".env")
client = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=8000)
db = client[os.environ["DB_NAME"]]


def set_banned(email: str, banned: bool):
    res = db.users.update_one({"email": email.lower()}, {"$set": {"is_banned": banned}})
    if res.matched_count == 0:
        print(f"No user found with email: {email}")
        return
    print(f"{'BANNED' if banned else 'UNBANNED'}: {email}")


def list_reports():
    rows = list(db.reports.find({"status": "open"}).sort("created_at", -1).limit(100))
    if not rows:
        print("No open reports.")
        return
    print(f"{len(rows)} open report(s):\n")
    for r in rows:
        reporter = db.users.find_one({"user_id": r.get("reporter_id")}, {"username": 1}) or {}
        target = r.get("target_id")
        if r.get("target_type") == "user":
            tu = db.users.find_one({"user_id": r.get("target_id")}, {"username": 1, "email": 1})
            if tu:
                target = f"@{tu.get('username')}  <{tu.get('email', '?')}>"
        print(f"- [{r.get('reason')}] {r.get('target_type')}: {target}")
        if r.get("details"):
            print(f"    note: {r['details']}")
        print(f"    by @{reporter.get('username', '?')}  on {r.get('created_at')}  (report_id: {r.get('report_id')})")
    print("\nAct on one:  python moderate.py ban <email>   then   python moderate.py resolve <report_id>")


def resolve(report_id: str):
    res = db.reports.update_one({"report_id": report_id}, {"$set": {"status": "resolved"}})
    print("Resolved." if res.matched_count else "Report not found.")


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else ""
    if cmd == "reports":
        list_reports()
    elif cmd == "ban" and len(args) >= 2:
        set_banned(args[1], True)
    elif cmd == "unban" and len(args) >= 2:
        set_banned(args[1], False)
    elif cmd == "resolve" and len(args) >= 2:
        resolve(args[1])
    else:
        print(__doc__)
    client.close()


if __name__ == "__main__":
    main()
