# harvest-automation
###  Harvest time tracking automation script

This script works with Google Chrome and Puppeteer to automatically enter time in the Harvest time tracking web app. <br>
For available options run `node index.js --help`<br>

Create projects.json in the root folder with json that matches your assigned projects

Example: 

```json
{
    "ADMIN":  {
        "name": "[123456] ADMIN", 
        "code": "123456",
        "tasks": {
            "H": "Holiday",
            "IM": "Internal meetings (company, team, 1-1, other)",
            "O": "Other",
            "R": "Recruiting",
            "ST": "Sick Time",
            "T": "Training",
            "PTO": "Vacation (PTO)"
        }
    }
}
```
