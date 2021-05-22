import csv
import random
import sys

if len(sys.argv)<2:
    print("Need number of rows")
    sys.exit(1)

records=int(sys.argv[1])

print("Making %d records\n" % records)

fieldnames=['id','name','age', 'social_security','telephone','city', 'gender']
writer = csv.DictWriter(open("people.csv", "w"), fieldnames=fieldnames)

names=['Deepak', 'Sangeeta', 'Geetika', 'Anubhav', 'Sahil', 'Akshay']
cities=['Delhi', 'Kolkata', 'Chennai', 'Mumbai']
gender=['Male', 'Female', "Other", "Unspecified"]

writer.writerow(dict(zip(fieldnames, fieldnames)))
for i in range(0, records):
  writer.writerow(dict([
    ('id', i),
    ('name', random.choice(names)),
    ('age', str(random.randint(16,85))),
    ('social_security', str(random.randint(9999999,99999999))),
    ('telephone', str(random.randint(999999,9999999))),
    ('city', random.choice(cities)),
    ('gender', random.choice(gender))
    ]))