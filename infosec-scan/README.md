#Infosec-scan


##Installation

Install python3 virtual env

`sudo apt install python3.10-venv`

Install infosec tools

`sudo ./install.sh`

##Launch owasp-zap

`./owasp-zap.sh http://localhost:3000`

Where http://localhost:3000 is address of web application that we plan to test.

###See results

zap.html

## Launch wapiti

`./wapiti.sh http://localhost:3000`

Where http://localhost:3000 is address of web application that we plan to test.

###See results

/home/asokolov/.wapiti/generated_report/localhost_3000_06022022_1907.html


