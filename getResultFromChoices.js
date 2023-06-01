function generateOutcome({ zero, one, two, three, four, six, wicket }) {
  const outcomes = {
    zero: zero,
    one: one,
    two: two,
    three: three,
    four: four,
    six: six,
    wicket: wicket,
  };

  const totalProbability = Object.values(outcomes).reduce(
    (sum, probability) => sum + probability,
    0
  );

  if (totalProbability !== 1) {
    // Normalize probabilities if they don't add up to 1
    for (const outcome in outcomes) {
      outcomes[outcome] /= totalProbability;
    }
  }

  const random = Math.random();
  let cumulativeProbability = 0;

  for (const outcome in outcomes) {
    cumulativeProbability += outcomes[outcome];
    if (random <= cumulativeProbability) {
      return outcome;
    }
  }
}

export function getResultFromChoices(batsman, bowler) {
  // batsman is from (0,1,2,3,4,6)
  // bowler speed is from (0, 1,2,3)

  if (batsman === 0 && bowler === 0) {
    return generateOutcome({
      zero: 900,
      one: 20,
      two: 20,
      three: 20,
      four: 10,
      six: 10,
      wicket: 10,
    });
  } else if (batsman === 0 && bowler === 1) {
    return generateOutcome({
      zero: 900,
      one: 50,
      two: 40,
      three: 30,
      four: 20,
      six: 20,
      wicket: 10,
    });
  } else if (batsman === 0 && bowler === 2) {
    return generateOutcome({
      zero: 900,
      one: 80,
      two: 60,
      three: 40,
      four: 30,
      six: 30,
      wicket: 20,
    });
  } else if (batsman === 0 && bowler === 3) {
    return generateOutcome({
      zero: 900,
      one: 100,
      two: 80,
      three: 60,
      four: 200,
      six: 200,
      wicket: 30,
    });
  } else if (batsman === 1 && bowler === 0) {
    return generateOutcome({
      zero: 20,
      one: 400,
      two: 50,
      three: 50,
      four: 20,
      six: 20,
      wicket: 10,
    });
  } else if (batsman === 1 && bowler === 1) {
    return generateOutcome({
      zero: 30,
      one: 500,
      two: 60,
      three: 60,
      four: 50,
      six: 40,
      wicket: 20,
    });
  } else if (batsman === 1 && bowler === 2) {
    return generateOutcome({
      zero: 40,
      one: 600,
      two: 70,
      three: 70,
      four: 60,
      six: 50,
      wicket: 30,
    });
  } else if (batsman === 1 && bowler === 3) {
    return generateOutcome({
      zero: 50,
      one: 600,
      two: 80,
      three: 80,
      four: 100,
      six: 100,
      wicket: 200,
    });
  } else if (batsman === 2 && bowler === 0) {
    return generateOutcome({
      zero: 30,
      one: 60,
      two: 500,
      three: 60,
      four: 50,
      six: 40,
      wicket: 20,
    });
  } else if (batsman === 2 && bowler === 1) {
    return generateOutcome({
      zero: 40,
      one: 70,
      two: 700,
      three: 70,
      four: 60,
      six: 50,
      wicket: 30,
    });
  } else if (batsman === 2 && bowler === 2) {
    return generateOutcome({
      zero: 50,
      one: 80,
      two: 600,
      three: 80,
      four: 70,
      six: 60,
      wicket: 40,
    });
  } else if (batsman === 2 && bowler === 3) {
    return generateOutcome({
      zero: 60,
      one: 90,
      two: 600,
      three: 90,
      four: 100,
      six: 100,
      wicket: 200,
    });
  } else if (batsman === 3 && bowler === 0) {
    return generateOutcome({
      zero: 40,
      one: 70,
      two: 60,
      three: 500,
      four: 60,
      six: 50,
      wicket: 30,
    });
  } else if (batsman === 3 && bowler === 1) {
    return generateOutcome({
      zero: 50,
      one: 80,
      two: 70,
      three: 700,
      four: 70,
      six: 60,
      wicket: 40,
    });
  } else if (batsman === 3 && bowler === 2) {
    return generateOutcome({
      zero: 60,
      one: 90,
      two: 80,
      three: 600,
      four: 80,
      six: 70,
      wicket: 50,
    });
  } else if (batsman === 3 && bowler === 3) {
    return generateOutcome({
      zero: 70,
      one: 100,
      two: 90,
      three: 600,
      four: 100,
      six: 100,
      wicket: 250,
    });
  } else if (batsman === 4 && bowler === 0) {
    return generateOutcome({
      zero: 50,
      one: 80,
      two: 70,
      three: 60,
      four: 800,
      six: 70,
      wicket: 40,
    });
  } else if (batsman === 4 && bowler === 1) {
    return generateOutcome({
      zero: 60,
      one: 90,
      two: 80,
      three: 70,
      four: 700,
      six: 80,
      wicket: 50,
    });
  } else if (batsman === 4 && bowler === 2) {
    return generateOutcome({
      zero: 70,
      one: 100,
      two: 90,
      three: 80,
      four: 600,
      six: 90,
      wicket: 60,
    });
  } else if (batsman === 4 && bowler === 3) {
    return generateOutcome({
      zero: 80,
      one: 110,
      two: 100,
      three: 90,
      four: 400,
      six: 150,
      wicket: 300,
    });
  } else if (batsman === 6 && bowler === 0) {
    return generateOutcome({
      zero: 800,
      one: 200,
      two: 100,
      three: 50,
      four: 40,
      six: 150,
      wicket: 20,
    });
  } else if (batsman === 6 && bowler === 1) {
    return generateOutcome({
      zero: 600,
      one: 200,
      two: 100,
      three: 50,
      four: 100,
      six: 200,
      wicket: 150,
    });
  } else if (batsman === 6 && bowler === 2) {
    return generateOutcome({
      zero: 100,
      one: 100,
      two: 100,
      three: 100,
      four: 300,
      six: 400,
      wicket: 400,
    });
  } else if (batsman === 6 && bowler === 3) {
    return generateOutcome({
      zero: 10,
      one: 20,
      two: 40,
      three: 50,
      four: 300,
      six: 400,
      wicket: 600,
    });
  }

  // Default case if no matching conditions are found
  return generateOutcome({
    zero: 0,
    one: 0,
    two: 0,
    three: 0,
    four: 0,
    six: 0,
    wicket: 0,
  });
}
