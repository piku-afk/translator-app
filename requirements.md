i want to build an app to translate the given text into english.
key requirement: i want to use cloudflare stack for this app such as workers, queue, D1 and R2 databases etc

workflow:

- the user will provide the source text file
- the app will extract chapters from the source text and save each chapters as txt files
- then using the system instructions it will go through each chapter and translate and write it to a md file
- check the poc/src/index.ts for detailed workflow

app:

- login page: it will contain a single password field, the user's entered password will be verified against a saved hashed password using bcrypt. Upon successful verification, the server will generate a secure HttpOnly cookie
- for each authenticated page, there will be a middleware that will check for the existence of this cookie
- new novel page: a form which will have fields for novel name, total number of chapters, raw text file
- create a new entry in database for the novel, and set status to "pending"
- then run a cloudflare queue for all "pending" novels - it will extract all the chapters from the raw text and saving on R2
  - save under novel name folder by chapter-number.txt
  - during this stage set novel status to "parsing"
  - it is possible that parsed chapters != total number of chapters, no need to take any action, just inform the user
- once all the chapters for a novel parsed, set novel status to "ready" and run a another queue which will start translating each chapter. run this queue sequentially for each chapters
  - during this stage, set novel status to "translating"
- once all chapters are translated, then mark the novel as completed
