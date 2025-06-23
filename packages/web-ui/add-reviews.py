import csv
import random

# Sample review templates with different sentiments
positive_reviews = [
    "Excellent service! Highly recommend.",
    "Great experience, will definitely come back.",
    "Outstanding quality and fast delivery!",
    "Very satisfied with my purchase. 5 stars!",
    "Amazing product, exceeded my expectations!",
    "Best company I've ever dealt with!",
    "Fantastic customer support and great prices.",
    "Love it! Exactly what I was looking for.",
    "Superb quality at a fair price.",
    "Couldn't be happier with this purchase!"
]

negative_reviews = [
    "Terrible experience. Would not recommend.",
    "Product broke after one week. Very disappointed.",
    "Customer service was rude and unhelpful.",
    "Complete waste of money. Avoid!",
    "Poor quality, nothing like the description.",
    "Shipping took forever and item was damaged.",
    "Worst purchase I've ever made.",
    "Scam! Never received my order.",
    "Cheap materials, fell apart immediately.",
    "False advertising. Very misleading."
]

neutral_reviews = [
    "It's okay. Nothing special but works.",
    "Average product for an average price.",
    "Does the job but could be better.",
    "Not bad, not great. Just okay.",
    "Meets basic expectations.",
    "Functional but uninspiring.",
    "Standard quality, as expected.",
    "No complaints but nothing exceptional.",
    "Decent value for money.",
    "Works as described, nothing more."
]

# Read the original CSV
with open('customers-2000.csv', 'r') as infile:
    reader = csv.DictReader(infile)
    fieldnames = reader.fieldnames + ['Review', 'Rating', 'Sentiment']
    
    # Write new CSV with reviews
    with open('customers-2000-with-reviews.csv', 'w', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in reader:
            # Randomly assign sentiment (40% positive, 30% negative, 30% neutral)
            rand = random.random()
            if rand < 0.4:
                row['Review'] = random.choice(positive_reviews)
                row['Rating'] = random.choice([4, 5])
                row['Sentiment'] = 'Positive'
            elif rand < 0.7:
                row['Review'] = random.choice(negative_reviews)
                row['Rating'] = random.choice([1, 2])
                row['Sentiment'] = 'Negative'
            else:
                row['Review'] = random.choice(neutral_reviews)
                row['Rating'] = 3
                row['Sentiment'] = 'Neutral'
            
            writer.writerow(row)

print("Created customers-2000-with-reviews.csv with sentiment data!")