def calculate_primes(n):
    primes = []
    possiblePrime = 2
    while len(primes) < n:
        isPrime = True
        for num in range(2, int(possiblePrime ** 0.5) + 1):
            if possiblePrime % num == 0:
                isPrime = False
                break
        if isPrime:
            primes.append(possiblePrime)
        possiblePrime += 1
    return primes

print(calculate_primes(1000))