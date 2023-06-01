import express from "express";
import mysql2 from "mysql2";
import cors from "cors";
import util from "util";
import { getResultFromChoices } from "./getResultFromChoices.js";

const app = express();
app.use(express.json());
app.use(cors());

function ballsToOvers(balls) {
  const overs = Math.floor(balls / 6); // Calculate the number of complete overs
  const remainingBalls = balls % 6; // Calculate the remaining balls

  return `${overs}.${remainingBalls}`;
}

const connection = mysql2.createPool({
  host: "sql.freedb.tech",
  user: "freedb_Happy",
  password: "4MzjpaYF8@N&Zkf",
  database: "freedb_cricketgame",
});

const query = util.promisify(connection.query).bind(connection);

// connection.connect((error) => {
//   if (error) {
//     console.log("Error connecting to database:", error);
//   } else {
//     console.log("Connected to database successfully");
//   }
// });

const getCurrentBattingTeam = async (matchId) => {
  const match = await query("SELECT * FROM matches WHERE id = ?", [matchId]);
  if (match.length === 0) {
    return { success: false, message: "Match not found" };
  }
  if (match[0].innings === 0) {
    return match[0].batting_first;
  } else {
    return match[0].batting_first === "team1" ? "team2" : "team1";
  }
};

const getCurrentTeamWickets = async (matchId) => {
  const currentBattingTeam = await getCurrentBattingTeam(matchId);
  if (currentBattingTeam === "team1") {
    const matches = await query("SELECT wickets1 FROM matches WHERE id = ?", [
      matchId,
    ]);
    return matches[0].wickets1;
  } else if (currentBattingTeam === "team2") {
    const matches = await query("SELECT wickets2 FROM matches WHERE id = ?", [
      matchId,
    ]);
    return matches[0].wickets2;
  }
};

const addWicket = async (matchId, battingTeam) => {
  if (battingTeam === "team1") {
    await query("UPDATE matches SET wickets1 = wickets1 + 1 WHERE id = ?", [
      matchId,
    ]);
  } else {
    await query("UPDATE matches SET wickets2 = wickets2 + 1 WHERE id = ?", [
      matchId,
    ]);
  }

  await query(
    "UPDATE players SET isStriker = 0, isOut = 1 WHERE matchId = ? AND isStriker = 1",
    [matchId]
  );
  await query(
    "UPDATE players SET wicketsTaken = wicketsTaken + 1 WHERE matchId = ? AND isBowler = 1",
    [matchId]
  );
};

const addBall = async (matchId, battingTeam) => {
  if (battingTeam === "team1") {
    await query("UPDATE matches SET balls1 = balls1 + 1 WHERE id = ?", [
      matchId,
    ]);
  } else {
    await query("UPDATE matches SET balls2 = balls2 + 1 WHERE id = ?", [
      matchId,
    ]);
  }
  await query(
    "UPDATE players SET balls = balls + 1 WHERE matchId = ? AND isStriker = 1",
    [matchId]
  );
  await query(
    "UPDATE players SET ballsBowled = ballsBowled + 1 WHERE matchId = ? AND isBowler = 1",
    [matchId]
  );
};

const addScore = async (score, matchId, battingTeam) => {
  if (battingTeam === "team1") {
    await query("UPDATE matches SET score1 = score1 + ? WHERE id = ?", [
      score,
      matchId,
    ]);
  } else {
    await query("UPDATE matches SET score2 = score2 + ? WHERE id = ?", [
      score,
      matchId,
    ]);
  }
  await query(
    "UPDATE players SET score = score + ?, fours = fours + ?, sixes = sixes + ? WHERE matchId = ? AND isStriker = 1",
    [score, score === 4 ? 1 : 0, score === 6 ? 1 : 0, matchId]
  );
  await query(
    "UPDATE players SET runsGiven = runsGiven + ? WHERE matchId = ? AND isBowler = 1",
    [score, matchId]
  );
};

const getTargetAndRemainingBalls = async (matchId) => {
  const match = await query("SELECT * FROM matches WHERE id = ?", [matchId]);
  let target = 0;
  let remainingBalls = 0;
  if (match[0].batting_first === "team1") {
    target = match[0].score1 + 1 - match[0].score2;
    remainingBalls = match[0].total_balls - match[0].balls2;
  } else if (match[0].batting_first === "team2") {
    target = match[0].score2 + 1 - match[0].score1;
    remainingBalls = match[0].total_balls - match[0].balls1;
  }
  return {
    target: target,
    remainingBalls: remainingBalls >= 0 ? remainingBalls : 0,
  };
};

app.post("/api/getTargetAndRemainingBalls", async (req, res) => {
  const { matchId } = req.body;
  const { target, remainingBalls } = await getTargetAndRemainingBalls(matchId);
  res.send({ target, remainingBalls });
});

const checkInnings = async (matchId) => {
  const innings = (
    await query("SELECT innings FROM matches WHERE id = ?", [matchId])
  )[0].innings;
  return innings;
};

const whoAreBatting = async (matchId) => {
  const getBatsmenStatsQuery =
    "SELECT * FROM players WHERE matchId = ? AND (isStriker = 1 OR isNonStriker = 1)";
  const results = await query(getBatsmenStatsQuery, [matchId]);
  return results;
};

const whoIsBowling = async (matchId) => {
  const getBatsmenStatsQuery =
    "SELECT * FROM players WHERE matchId = ? AND isBowler = 1";
  const results = await query(getBatsmenStatsQuery, [matchId]);
  return results;
};

const removeBowler = async (matchId) => {
  await query(
    "UPDATE players SET isBowler = 0 WHERE matchId = ? AND isBowler = 1",
    [matchId]
  );
};

const interChangeStrikers = (matchId) => {
  const interChangeStrikers =
    "UPDATE players SET isStriker = isStriker + isNonStriker, isNonStriker = isStriker - isNonStriker, isStriker = isStriker - isNonStriker WHERE matchId = ?;";
  connection.query(interChangeStrikers, [matchId], (error) => {
    if (error) {
      console.log(error);
      return;
    }
  });
};

const removeBatsmen = async (matchId) => {
  await query(
    "UPDATE players SET isStriker = 0, isNonStriker = 0 WHERE matchId = ? AND (isStriker = 1 OR isNonStriker = 1)",
    [matchId]
  );
};

const setInnings = async (matchId, innings) => {
  await query("UPDATE matches SET innings = ? WHERE id = ?", [
    innings,
    matchId,
  ]);
};

const SwitchToSecondInnings = async (matchId) => {
  await setInnings(matchId, 1);
  await removeBowler(matchId);
  await removeBatsmen(matchId);

  return { secondInnings: true };
};

async function updateStats({ matchId, score, wicket }) {
  const batsmen = await whoAreBatting(matchId);
  const bowler = await whoIsBowling(matchId);
  if (batsmen.length < 2 || bowler.length !== 1) {
    return { secondInnings: false };
  }
  const getInningsAndBattingFirstQuery = "SELECT * FROM matches WHERE id = ?";
  connection.query(
    getInningsAndBattingFirstQuery,
    [matchId],
    (error, results) => {
      if (error) {
        console.error("Error checking batting_first in the database:", error);
        return { secondInnings: false };
      }
      const stats = results[0];
      const battingFirst = stats.batting_first;
      const innings = stats.innings;

      if (innings !== 0) {
        updateStats2(matchId, score, wicket, innings);
        return { secondInnings: false };
      }

      let updateQuery = "";

      if (innings === 0) {
        if (battingFirst === "team1") {
          updateQuery +=
            "UPDATE matches SET score1 = score1 + ?, balls1 = balls1 + 1, wickets1 = wickets1 + ?";
        } else if (battingFirst === "team2") {
          updateQuery +=
            "UPDATE matches SET score2 = score2 + ?, balls2 = balls2 + 1, wickets2 = wickets2 + ?";
        }
      } else if (innings === 1) {
        if (battingFirst === "team2") {
          updateQuery +=
            "UPDATE matches SET score1 = score1 + ?, balls1 = balls1 + 1, wickets1 = wickets1 + ?";
        } else if (battingFirst === "team1") {
          updateQuery +=
            "UPDATE matches SET score2 = score2 + ?, balls2 = balls2 + 1, wickets2 = wickets2 + ?";
        }
      }

      updateQuery += " WHERE id = ?;";

      connection.query(
        updateQuery,
        [score, wicket, matchId],
        (error, results) => {
          if (error) {
            console.error(error);
            return { secondInnings: false };
          }

          if (results.affectedRows === 1) {
            const updatePlayersQuery =
              "UPDATE players SET score = score + ?, isOut = ?, isStriker = ?, balls = balls + 1, fours = fours + ?, sixes = sixes + ? WHERE matchId = ? AND isStriker = 1;";

            connection.query(
              updatePlayersQuery,
              [
                score,
                wicket === 1 ? 1 : 0,
                wicket === 1 ? 0 : 1,
                score === 4 ? 1 : 0,
                score === 6 ? 1 : 0,
                matchId,
              ],
              (error, results) => {
                if (error) {
                  console.error(error);
                  return { secondInnings: false };
                }

                const bowlerQuery =
                  "UPDATE players SET runsGiven = runsGiven + ?, wicketsTaken = wicketsTaken + ?, ballsBowled = ballsBowled + 1 WHERE matchId = ? AND isBowler = 1";
                connection.query(
                  bowlerQuery,
                  [score, wicket, matchId],
                  (error,
                  (error, results) => {
                    if (error) {
                      console.error(error);
                      return { secondInnings: false };
                    }

                    if (stats.batting_first === "team1") {
                      if (
                        stats.wickets1 + wicket >= 10 ||
                        stats.balls1 + 1 >= stats.total_balls
                      ) {
                        return SwitchToSecondInnings(matchId);
                      } else if (score % 2 === 1) {
                        interChangeStrikers(matchId);
                      }
                    } else if (stats.batting_first === "team2") {
                      if (
                        stats.wickets2 + wicket >= 10 ||
                        stats.balls2 + 1 >= stats.total_balls
                      ) {
                        return SwitchToSecondInnings(matchId);
                      } else if (score % 2 === 1) {
                        interChangeStrikers(matchId);
                      }
                    }

                    if (stats.batting_first === "team1") {
                      if ((stats.balls1 + 1) % 6 === 0) {
                        removeBowler(matchId);
                        interChangeStrikers(matchId);
                      }
                    } else if (stats.batting_first === "team2") {
                      if ((stats.balls2 + 1) % 6 === 0) {
                        removeBowler(matchId);
                        interChangeStrikers(matchId);
                      }
                    }
                  })
                );
              }
            );
          }
        }
      );
    }
  );
}

const getSelfTeamName = async (matchId, team) => {
  return (
    await query("SELECT " + team + " FROM matches WHERE id = ?", [matchId])
  )[0][team];
};

const getBattingFirst = async (matchId) => {
  return (
    await query("SELECT batting_first FROM matches WHERE id = ?", [matchId])
  )[0].batting_first;
};

const getWinner = async (matchId) => {
  const match = (
    await query("SELECT score1, score2 FROM matches WHERE id = ?", [matchId])
  )[0];
  return match.score1 > match.score2
    ? "team1"
    : match.score1 < match.score2
    ? "team2"
    : "tied";
};

const getScoreDifference = async (matchId) => {
  const match = (
    await query("SELECT score1, score2 FROM matches WHERE id = ?", [matchId])
  )[0];
  return Math.abs(match.score1 - match.score2);
};

const getResult = async (matchId) => {
  const winner = await getWinner(matchId);
  const battingFirst = await getBattingFirst(matchId);

  if (winner === "tied") {
    return "Match Tied.";
  }

  if (winner === battingFirst) {
    return (
      (await getSelfTeamName(matchId, winner)) +
      " won by " +
      (await getScoreDifference(matchId)) +
      " runs."
    );
  } else {
    return (
      (await getSelfTeamName(matchId, winner)) +
      " won by " +
      (10 - (await getCurrentTeamWickets(matchId))).toString() +
      " wickets."
    );
  }
};

const setResult = async (matchId, result) => {
  await query("UPDATE matches SET matchResult = ? WHERE id = ?", [
    result,
    matchId,
  ]);
};

const getMatchEnded = async (matchId) => {
  const targetAndRemainingBalls = await getTargetAndRemainingBalls(matchId);
  const remainingBalls = targetAndRemainingBalls.remainingBalls;
  const target = targetAndRemainingBalls.target;
  const currentWickets = await getCurrentTeamWickets(matchId);
  if (remainingBalls <= 0) {
    await setResult(matchId, await getResult(matchId));
    return true;
  } else if (target <= 0) {
    await setResult(matchId, await getResult(matchId));
    return true;
  } else if (currentWickets >= 10) {
    await setResult(matchId, await getResult(matchId));
    return true;
  } else {
    return false;
  }
};

const updateStats2 = async (matchId, score, wicket, innings) => {
  if (innings !== 1) {
    return;
  }
  const battingTeam = await getCurrentBattingTeam(matchId);
  await addBall(matchId, battingTeam);

  if (wicket) {
    await addWicket(matchId, battingTeam);
  }

  if (score) {
    await addScore(score, matchId, battingTeam);
  }

  if (score % 2 === 1) {
    interChangeStrikers(matchId);
  }

  const match =
    battingTeam === "team1"
      ? await query("SELECT balls1 FROM matches WHERE id = ?", [matchId])
      : await query("SELECT balls2 FROM matches WHERE id = ?", [matchId]);

  const balls = battingTeam === "team1" ? match[0].balls1 : match[0].balls2;

  if (balls % 6 === 0) {
    removeBowler(matchId);
    interChangeStrikers(matchId);
  }
  const matchEnded = await getMatchEnded(matchId);
  if (matchEnded) {
    await query("UPDATE matches SET innings = 2 WHERE id = ?", [matchId]);
    return;
  }
};

app.post("/api/hostNewGame", (req, res) => {
  const payload = req.body;
  const { teamName, playerNames, overs } = payload;
  const totalBalls = overs * 6;

  const tossCaller = Math.random() < 0.5 ? "team1" : "team2";

  const queryMatches =
    "INSERT INTO matches (team1, score1, score2, wickets1, wickets2, innings, balls1, balls2, total_balls, toss_caller) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  connection.query(
    queryMatches,
    [teamName, 0, 0, 0, 0, 0, 0, 0, totalBalls, tossCaller],
    (error, results) => {
      if (error) {
        console.error("Error inserting data into the matches table:", error);
        res.status(500).send("Error inserting data into the database");
      } else {
        const insertedId = results.insertId;

        const queryPlayers =
          "INSERT INTO players (matchId, team, playerName, score, balls, fours, sixes, type, isOut, runsGiven, wicketsTaken, ballsBowled) VALUES ?";
        const playersData = playerNames.map((playerName, index) => [
          insertedId,
          "team1",
          playerName,
          0,
          0,
          0,
          0,
          index < 6 ? "batsman" : "bowler",
          0,
          0,
          0,
          0,
        ]);

        connection.query(queryPlayers, [playersData], (error) => {
          if (error) {
            console.error(
              "Error inserting data into the players table:",
              error
            );
            res.status(500).send("Error inserting data into the database");
          } else {
            res.status(200).json({
              id: insertedId,
              tossCaller: tossCaller === "team1",
            });
          }
        });
      }
    }
  );
});

app.post("/api/joinGame", (req, res) => {
  const payload = req.body;
  const { matchId, teamName, playerNames } = payload;

  const checkTeam2Query =
    "SELECT team2, team1, toss_caller FROM matches WHERE id = ?";
  connection.query(checkTeam2Query, [matchId], (error, results) => {
    if (error) {
      console.error("Error checking team2 in the database:", error);
      res.status(500).json({
        success: false,
        message: "Error checking team2 in the database",
      });
    } else {
      if (results.length === 0) {
        res.status(200).json({
          success: false,
          message: "The desired match is currently unavailable.",
        });
        return;
      }
      const team2 = results[0].team2;
      const team1 = results[0].team1;
      const tossCaller = results[0].toss_caller;

      if (!team2) {
        const updateTeam2Query = "UPDATE matches SET team2 = ? WHERE id = ?";
        connection.query(updateTeam2Query, [teamName, matchId], (error) => {
          if (error) {
            console.error("Error updating team2 data in the database:", error);
            res.status(500).json({
              success: false,
              message: "Error updating team2 data in the database",
            });
          } else {
            const insertPlayersQuery =
              "INSERT INTO players (matchId, team, playerName, score, balls, fours, sixes, type, isOut, runsGiven, wicketsTaken, ballsBowled) VALUES ?";
            const playersData = playerNames.map((playerName, index) => [
              matchId,
              "team2",
              playerName,
              0,
              0,
              0,
              0,
              index < 6 ? "batsman" : "bowler",
              0,
              0,
              0,
              0,
            ]);
            connection.query(insertPlayersQuery, [playersData], (error) => {
              if (error) {
                console.error(
                  "Error inserting players data into the database:",
                  error
                );
                res.status(500).json({
                  success: false,
                  message: "Error inserting players data into the database",
                });
              } else {
                res.status(200).json({
                  success: true,
                  opponentTeamName: team1,
                  tossCaller: tossCaller === "team2",
                });
              }
            });
          }
        });
      } else {
        res.status(200).json({
          success: false,
          message: "Match has already started, Please join another game.",
        });
      }
    }
  });
});

app.post("/api/checkOpponent", async (req, res) => {
  const { id } = req.body;
  const match = await query("SELECT team2 FROM matches WHERE id = ?", [id]);
  if (match.length === 0) {
    res.status(200).json({ opponentTeamName: null });
  } else {
    const opponentTeamName = match[0].team2;
    res.status(200).json({ opponentTeamName });
  }
});

app.post("/api/submitChoice", (req, res) => {
  const payload = req.body;
  const { id, team } = payload;

  // Randomly select the toss winner
  const tossWinner = Math.random() < 0.5 ? "team1" : "team2";

  // Check if the chosen team is the same as the toss winner
  const hasWon = team === tossWinner;

  // Update the toss_winner column in the database
  const updateQuery = "UPDATE matches SET toss_winner = ? WHERE id = ?";
  connection.query(updateQuery, [tossWinner, id], (error, results) => {
    if (error) {
      console.error("Error updating toss winner in the database:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    } else {
      res.status(200).json({ hasWon });
    }
  });
});

app.post("/api/refreshOpponent", (req, res) => {
  const payload = req.body;
  const { id, team } = payload;

  // Retrieve the toss_winner from the database for the given id
  const selectQuery = "SELECT toss_winner FROM matches WHERE id = ?";
  connection.query(selectQuery, [id], (error, results) => {
    if (error) {
      console.error("Error retrieving toss winner from the database:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    } else {
      const tossWinner = results[0].toss_winner;
      if (tossWinner === null) {
        res.send({ success: false });
      } else {
        // Check if the toss winner is the same as the team
        const hasWon = tossWinner === team;

        res.status(200).json({ success: true, hasWon });
      }
    }
  });
});

app.post("/api/chooseBatOrBall", async (req, res) => {
  const payload = req.body;
  const { decision, id } = payload;

  const match = await query(
    "SELECT batting_first, toss_winner FROM matches WHERE id = ?",
    [id]
  );

  if (!match) {
    res.send({ success: false, message: "Match not found." });
    return;
  }

  const battingFirst = match[0].batting_first;

  if (battingFirst) {
    res.send({ success: false, message: "Batting order already decided." });
    return;
  } else {
    if (match[0].toss_winner === "team1") {
      if (decision === "bat") {
        await query("UPDATE matches SET batting_first = ? WHERE id = ?", [
          "team1",
          id,
        ]);
      } else {
        await query("UPDATE matches SET batting_first = ? WHERE id = ?", [
          "team2",
          id,
        ]);
      }
    } else if (match[0].toss_winner === "team2") {
      if (decision === "bat") {
        await query("UPDATE matches SET batting_first = ? WHERE id = ?", [
          "team2",
          id,
        ]);
      } else {
        await query("UPDATE matches SET batting_first = ? WHERE id = ?", [
          "team1",
          id,
        ]);
      }
    }
  }

  res.send({ success: true });
});

app.post("/api/getTossDecision", (req, res) => {
  const { id } = req.body;

  // Use the provided id and team to query the database and retrieve the toss decision
  connection.query(
    "SELECT toss_winner, batting_first FROM matches WHERE id = ?",
    [id],
    (error, results) => {
      if (error) {
        console.error("Error retrieving toss decision:", error);
        res.status(500).json({ message: "Failed to retrieve toss decision" });
      } else {
        if (results.length === 0) {
          // Handle case where no match is found for the provided id
          res.status(404).json({ message: "Match not found" });
        } else {
          const matchData = results[0];
          const tossWinner = matchData.toss_winner;
          const battingFirst = matchData.batting_first;

          if (!battingFirst) {
            res.send({ message: "Not known yet." });
          } else {
            let tossDecision = "";
            if (tossWinner === battingFirst) {
              tossDecision = "bat";
            } else {
              tossDecision = "bowl";
            }

            res.json({ decision: tossDecision });
          }
        }
      }
    }
  );
});

app.post("/api/getPlayers", (req, res) => {
  const { id, team } = req.body;

  const queryNotPlayed = `SELECT * FROM players WHERE team = ? AND matchId = ? AND isOut = 0 AND isStriker = 0 AND isNonStriker = 0`;
  const queryPlayed = `SELECT * FROM players WHERE team = ? AND matchId = ? AND (isStriker = 1 OR isNonStriker = 1 OR isOut = 1)`;

  // Query for players who have not played
  connection.query(queryNotPlayed, [team, id], (error, resultNotPlayed) => {
    if (error) {
      console.log("Error fetching players who have not played:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    const playersNotPlayed = resultNotPlayed.map((player) => ({
      id: player.id,
      name: player.playerName,
    }));

    // Query for players who have played
    connection.query(queryPlayed, [team, id], (error, resultPlayed) => {
      if (error) {
        console.log("Error fetching players who have played:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

      const playersPlayed = resultPlayed.map((player) => ({
        id: player.id,
        name: player.playerName,
        score: player.score,
        ballsTaken: player.balls,
      }));

      res.status(200).json({ playersNotPlayed, playersPlayed });
    });
  });
});

app.post("/api/selectPlayer", (req, res) => {
  const { id, team, playerId } = req.body;

  // Check if there is already a striker and non-striker for the given match and team
  const checkStrikerQuery = `SELECT COUNT(*) AS strikerCount FROM players WHERE matchId = ? AND team = ? AND isStriker = 1`;
  const checkNonStrikerQuery = `SELECT COUNT(*) AS nonStrikerCount FROM players WHERE matchId = ? AND team = ? AND isNonStriker = 1`;

  connection.query(checkStrikerQuery, [id, team], (error, strikerResult) => {
    if (error) {
      console.log("Error checking striker:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }

    connection.query(
      checkNonStrikerQuery,
      [id, team],
      (error, nonStrikerResult) => {
        if (error) {
          console.log("Error checking non-striker:", error);
          return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        }

        const strikerCount = strikerResult[0].strikerCount;
        const nonStrikerCount = nonStrikerResult[0].nonStrikerCount;

        if (strikerCount === 0) {
          // Set the selected player as the striker
          const updateStrikerQuery = `UPDATE players SET isStriker = 1 WHERE id = ?`;
          connection.query(updateStrikerQuery, [playerId], (error) => {
            if (error) {
              console.log("Error setting striker:", error);
              return res
                .status(500)
                .json({ success: false, message: "Internal server error" });
            }

            res.status(200).json({ success: true });
          });
        } else if (nonStrikerCount === 0) {
          // Set the selected player as the non-striker
          const updateNonStrikerQuery = `UPDATE players SET isNonStriker = 1 WHERE id = ?`;
          connection.query(updateNonStrikerQuery, [playerId], (error) => {
            if (error) {
              console.log("Error setting non-striker:", error);
              return res
                .status(500)
                .json({ success: false, message: "Internal server error" });
            }

            res.status(200).json({ success: true });
          });
        } else {
          // Both striker and non-striker already assigned
          res.status(200).json({
            success: false,
            message: "Striker and non-striker already assigned",
          });
        }
      }
    );
  });
});

app.post("/api/getBowlers", (req, res) => {
  const { id, team } = req.body;

  const query = `SELECT id, playerName, isBowler, runsGiven, wicketsTaken, ballsBowled FROM players WHERE matchId = ? AND team = ? AND type = ?`;

  connection.query(query, [id, team, "bowler"], (error, results) => {
    if (error) {
      console.error("Error fetching bowler data:", error);
      res
        .status(500)
        .json({ error: "An error occurred while fetching bowler data." });
    } else {
      const bowlers = results.map((result) => ({
        id: result.id,
        playerName: result.playerName,
        isBowler: result.isBowler,
        runsGiven: result.runsGiven,
        wicketsTaken: result.wicketsTaken,
        overs: ballsToOvers(result.ballsBowled),
      }));
      res.json(bowlers);
    }
  });
});

app.post("/api/saveBowler", (req, res) => {
  const { id, team, bowlerId } = req.body;

  // Set isBowler to 0 for the existing bowler
  const disableBowlerQuery = `UPDATE players SET isBowler = 0 WHERE matchId = ? AND team = ? AND isBowler = 1`;

  // Set isBowler to 1 for the selected bowler
  const enableBowlerQuery = `UPDATE players SET isBowler = 1 WHERE matchId = ? AND id = ?`;

  connection.query(disableBowlerQuery, [id, team], (error1, disableResult) => {
    if (error1) {
      console.error("Error disabling previous bowler:", error1);
      res.status(500).json({
        error: "An error occurred while disabling the previous bowler.",
      });
    } else {
      connection.query(
        enableBowlerQuery,
        [id, bowlerId],
        (error2, enableResult) => {
          if (error2) {
            console.error("Error enabling new bowler:", error2);
            res.status(500).json({
              error: "An error occurred while enabling the new bowler.",
            });
          } else {
            res.json({ success: true });
          }
        }
      );
    }
  });
});

app.post("/api/getShowSelectBowler", (req, res) => {
  const { matchId, team } = req.body;

  const getIsBowlerQuery =
    "SELECT * FROM players WHERE matchId = ? AND team = ? AND isBowler = 1";
  connection.query(
    getIsBowlerQuery,
    [matchId, team],
    (error, results, fields) => {
      if (error) {
        console.log(error);
        res.send({
          success: false,
          message:
            "Error occured while establishing coonection to the database.",
        });
        return;
      }

      if (results.length === 0) {
        res.send({ success: true, message: "Success", showSelectBowler: true });
      } else if (results.length === 1) {
        res.send({
          success: true,
          showSelectBowler: false,
          message: "There is already a bowler existing.",
        });
      } else {
        res.send({
          success: false,
          showSelectBowler: false,
          message: "There are more than 1 bowlers.",
        });
      }
    }
  );
});

app.post("/api/getBowlerStats", (req, res) => {
  const { matchId, team } = req.body;
  const batsmenQuery =
    "SELECT playerName, score, balls, fours, sixes, isStriker, isNonStriker FROM players WHERE matchId = ? AND team != ? AND (isStriker = 1 OR isNonStriker = 1) AND isOut = 0";
  const parameters = [matchId, team];
  connection.query(batsmenQuery, parameters, (error, results, fields) => {
    if (error) {
      console.error(error);
      res.send({ success: false, message: "Error occured in the database." });
      return;
    }

    const bowlerQuery =
      "SELECT playerName, ballsBowled, runsGiven, wicketsTaken  FROM players WHERE matchId = ? AND team = ? AND isBowler = 1";
    connection.query(bowlerQuery, parameters, (error, results2, fields) => {
      if (error) {
        console.log(error);
        res.send({ success: false, message: "DB error" });
        return;
      }

      const matchQuery = "SELECT * FROM matches WHERE id = ?";
      connection.query(matchQuery, [matchId], (error, results3, fields) => {
        if (error) {
          console.log(error);
          res.send({ success: false, message: "DB error" });
          return;
        }

        const totalOvers = ballsToOvers(results3[0].total_balls);

        const score =
          team === "team2" ? results3[0].score1 : results3[0].score2;
        const balls =
          team === "team2" ? results3[0].balls1 : results3[0].balls2;

        const wickets =
          team === "team2" ? results3[0].wickets1 : results3[0].wickets2;

        const oversBowled = ballsToOvers(balls);

        const bowlerStats = results2.map((bowler) => ({
          ...bowler,
          overs: ballsToOvers(bowler.ballsBowled),
        }));

        const economy =
          bowlerStats.length > 0
            ? (bowlerStats[0].runsGiven * 6) / bowlerStats[0].ballsBowled
            : "NaN";

        res.send({
          success: true,
          score: score,
          wickets: wickets,
          batsmen: results,
          bowler: bowlerStats,
          match: results3,
          totalOvers: totalOvers,
          oversBowled: oversBowled,
          economy: economy,
        });
      });
    });
  });
});

app.post("/api/getShowBatsmanSelector", (req, res) => {
  const { matchId, team } = req.body;
  const getShowBatsmanSelectorQuery =
    "SELECT * FROM players WHERE matchId = ? AND team = ? AND (isStriker = 1 OR isNonStriker = 1)";
  connection.query(
    getShowBatsmanSelectorQuery,
    [matchId, team],
    (error, results, fields) => {
      if (error) {
        console.log(error);
        res.send({
          success: false,
          message:
            "Error occured while establishing coonection to the database.",
        });
        return;
      }

      if (results.length < 2) {
        res.send({
          success: true,
          showBatsmanSelector: true,
          message: "We need a batsman.",
        });
      } else if (results.length === 2) {
        res.send({
          success: true,
          showBatsmanSelector: false,
          message: "There are already 2 batsmen.",
        });
      } else {
        res.send({
          success: false,
          message: "There are invalid number of batsmen.",
        });
      }
    }
  );
});

app.post("/api/getStatsForBatterPage", (req, res) => {
  const { matchId, team } = req.body;
  const matchQuery = "SELECT * FROM matches WHERE id = ?";
  connection.query(matchQuery, [matchId], (error, results) => {
    if (error) {
      console.log(error);
      res.send({
        success: false,
        message: "Error occured while establishing coonection to the database.",
      });
      return;
    }
    if (results.length === 0) {
      console.log("No such match found.");
      res.send({ success: false, message: "No such match found." });
      return;
    }
    const batsmenQuery =
      "SELECT * FROM players WHERE matchId = ? AND team = ? AND (isStriker = 1 OR isNonStriker = 1)";
    connection.query(batsmenQuery, [matchId, team], (error, results2) => {
      if (error) {
        console.log(error);
        res.send({
          success: false,
          message:
            "Error occured while establishing coonection to the database.",
        });
        return;
      }

      const bowlerQuery =
        "SELECT * FROM players WHERE matchId = ? AND team != ? AND isBowler = 1";
      connection.query(bowlerQuery, [matchId, team], (error, results3) => {
        if (error) {
          console.log(error);
          res.send({
            success: false,
            message:
              "Error occured while establishing coonection to the database.",
          });
        }

        const score = team === "team1" ? results[0].score1 : results[0].score2;
        const balls = team === "team1" ? results[0].balls1 : results[0].balls2;

        const selfTeamName =
          team === "team1" ? results[0].team1 : results[0].team2;

        const opponentTeamName =
          team === "team2" ? results[0].team1 : results[0].team2;

        const batsmen = results2;
        const bowler = results3;

        const wickets =
          team === "team1" ? results[0].wickets1 : results[0].wickets2;

        const currentStrikeRate = ((score * 100) / balls).toFixed(2);

        const totalBalls = results[0].total_balls;

        const projectedScore = ((currentStrikeRate / 100) * totalBalls).toFixed(
          2
        );

        const bowlerStats = results3.map((bowler) => ({
          ...bowler,
          overs: ballsToOvers(bowler.ballsBowled),
        }));

        res.send({
          success: true,
          overs: ballsToOvers(balls),
          totalOvers: ballsToOvers(totalBalls),
          score,
          wickets,
          selfTeamName,
          opponentTeamName,
          batsmen,
          bowler: bowlerStats,
          currentStrikeRate,
          projectedScore,
        });
      });
    });
  });
});

app.post("/api/setBatsmanChoice", async (req, res) => {
  const { matchId, selectedRuns } = req.body;
  const getLastBallQuery =
    "SELECT * FROM balls WHERE matchId = ? ORDER BY id DESC LIMIT 1;";
  connection.query(getLastBallQuery, [matchId], async (error, results) => {
    if (error) {
      console.error(error);
      res.send({ success: false });
      return;
    }
    if (
      results.length === 0 ||
      (results[0].batsman_choice !== null && results[0].bowler_choice !== null)
    ) {
      const currentBattingTeam = await getCurrentBattingTeam(matchId);
      console.log("currentBattingTeam" + currentBattingTeam);
      const insertQuery =
        "INSERT INTO balls (matchId, batsman_choice, battingTeam) VALUES (?,?,?)";
      connection.query(
        insertQuery,
        [matchId, selectedRuns, currentBattingTeam],
        (error, insertBallResults) => {
          if (error) {
            console.error(error);
            res.send({ success: false });
            return;
          }
          res.send({ success: true, ballId: insertBallResults.insertId });
        }
      );
    } else if (
      results[0].batsman_choice === null &&
      results[0].bowler_choice !== null
    ) {
      const lastBallId = results[0].id;
      const updateBatsmanChoiceQuery =
        "UPDATE balls SET batsman_choice = ? WHERE id = ?";
      connection.query(
        updateBatsmanChoiceQuery,
        [selectedRuns, lastBallId],
        async (error, updateBatsmanChoiceResults) => {
          if (error) {
            console.error(error);
            res.send({ success: false });
            return;
          }
          const resultFromChoices = getResultFromChoices(
            selectedRuns,
            results[0].bowler_choice
          );

          const updateResultQuery = "UPDATE balls SET result = ? WHERE id = ?";

          connection.query(
            updateResultQuery,
            [resultFromChoices, lastBallId],
            async (error, updatedResult) => {
              if (error) {
                console.error(error);
                res.send({
                  success: false,
                  message: "Failed while connecting with db.",
                });
                return;
              }

              const score =
                resultFromChoices === "one"
                  ? 1
                  : resultFromChoices === "two"
                  ? 2
                  : resultFromChoices === "three"
                  ? 3
                  : resultFromChoices === "four"
                  ? 4
                  : resultFromChoices === "six"
                  ? 6
                  : 0;
              const wicket = resultFromChoices === "wicket" ? 1 : 0;

              const details = await updateStats({
                matchId,
                score,
                wicket,
              });

              if (details) {
                res.send({
                  success: true,
                  result: resultFromChoices,
                  secondInnings: details.secondInnings,
                });
              } else {
                res.send("Success");
              }
            }
          );
        }
      );
    } else {
      res.send({ success: true, status: "Please wait for opponent's move." });
    }
  });
});

app.post("/api/setBowlingSpeed", async (req, res) => {
  const { matchId, speed } = req.body;
  const getLastBallQuery =
    "SELECT * FROM balls WHERE matchId = ? ORDER BY id DESC LIMIT 1";
  connection.query(
    getLastBallQuery,
    [matchId],
    async (error, lastBallResult) => {
      if (error) {
        console.error(error);
        res.send({ success: false, message: "Failed make db query." });
        return;
      }
      const lastBall = lastBallResult[0];
      if (
        !lastBall ||
        (lastBall.batsman_choice !== null && lastBall.bowler_choice !== null)
      ) {
        const currentBattingTeam = await getCurrentBattingTeam(matchId);
        console.log("currentBattingTeam" + currentBattingTeam);
        const addBallQuery =
          "INSERT INTO balls (matchId, bowler_choice, battingTeam) VALUES (?,?,?)";
        connection.query(
          addBallQuery,
          [matchId, speed, currentBattingTeam],
          (error, addBallResults) => {
            if (error) {
              console.error(error);
              res.send({ success: false, message: "Failed make db query." });
              return;
            }

            res.send({ success: true, lastBallId: addBallResults.insertId });
          }
        );
      } else if (
        lastBall.bowler_choice === null &&
        lastBall.batsman_choice !== null
      ) {
        const lastBallId = lastBall.id;
        const updateBallQuery =
          "UPDATE balls SET bowler_choice = ? WHERE id = ?";
        connection.query(
          updateBallQuery,
          [speed, lastBallId],
          (error, updateBallResults) => {
            if (error) {
              console.error(error);
              res.send({ success: false, message: "Failed make db query." });
              return;
            }

            const resultFromChoices = getResultFromChoices(
              lastBall.batsman_choice,
              speed
            );

            const updateResultQuery =
              "UPDATE balls SET result = ? WHERE id = ?";

            connection.query(
              updateResultQuery,
              [resultFromChoices, lastBallId],
              async (error, updatedResult) => {
                if (error) {
                  console.error(error);
                  res.send({
                    success: false,
                    message: "Failed while connecting with db.",
                  });
                  return;
                }

                const score =
                  resultFromChoices === "one"
                    ? 1
                    : resultFromChoices === "two"
                    ? 2
                    : resultFromChoices === "three"
                    ? 3
                    : resultFromChoices === "four"
                    ? 4
                    : resultFromChoices === "six"
                    ? 6
                    : 0;
                const wicket = resultFromChoices === "wicket" ? 1 : 0;

                const details = await updateStats({
                  matchId,
                  score,
                  wicket,
                });

                if (details) {
                  res.send({
                    success: true,
                    result: resultFromChoices,
                    secondInnings: details.secondInnings,
                  });
                } else {
                  res.send("Success");
                }
              }
            );
          }
        );
      } else {
        res.send({
          success: true,
          message: "Please wait for the batsman to make his choice.",
        });
      }
    }
  );
});

app.post("/api/getOpponentNameAndScore", (req, res) => {
  const { matchId, team } = req.body;
  const getOpponentStatsQuery = "SELECT * FROM matches WHERE id = ?";
  connection.query(getOpponentStatsQuery, [matchId], (error, results) => {
    const result = results[0];
    let opponentStats = {};
    if (team === "team1") {
      opponentStats.teamName = result.team2;
      opponentStats.score = result.score2;
      opponentStats.wickets = result.wickets2;
      opponentStats.oversTaken = ballsToOvers(result.balls2);
    } else if (team === "team2") {
      opponentStats.teamName = result.team1;
      opponentStats.score = result.score1;
      opponentStats.wickets = result.wickets1;
      opponentStats.oversTaken = ballsToOvers(result.balls1);
    }
    opponentStats.totalOvers = ballsToOvers(result.total_balls);
    res.send(opponentStats);
  });
});

app.post("/api/getSelfStats", (req, res) => {
  const { matchId, team } = req.body;
  const getSelfStatsQuery = "SELECT * FROM matches WHERE id = ?";
  connection.query(getSelfStatsQuery, [matchId], (error, results) => {
    const result = results[0];
    let selfStats = {};
    if (team === "team2") {
      selfStats.teamName = result.team2;
      selfStats.score = result.score2;
      selfStats.wickets = result.wickets2;
      selfStats.oversTaken = ballsToOvers(result.balls2);
    } else if (team === "team1") {
      selfStats.teamName = result.team1;
      selfStats.score = result.score1;
      selfStats.wickets = result.wickets1;
      selfStats.oversTaken = ballsToOvers(result.balls1);
    }
    selfStats.totalOvers = ballsToOvers(result.total_balls);
    res.send(selfStats);
  });
});

app.post("/api/getBatsmenPlaying", async (req, res) => {
  const { matchId } = req.body;
  const batsmen = await whoAreBatting(matchId);
  if (batsmen.length > 0) {
    res.send(batsmen);
  } else {
    res.send([]);
  }
});

app.post("/api/getBowlerPlaying", async (req, res) => {
  const { matchId } = req.body;
  const bowler = await whoIsBowling(matchId);
  if (bowler.length > 0) {
    bowler[0].oversBowled = ballsToOvers(bowler[0].ballsBowled);
    res.send(bowler);
  } else {
    res.send([]);
  }
});

app.post("/api/checkInnings", async (req, res) => {
  const { matchId } = req.body;
  if (matchId !== undefined) {
    const innings = await checkInnings(matchId);
    console.log(
      "inningssssssssssssssssssssssssssssssssssssssssssssssssssssss: ",
      innings
    );
    res.send({ innings: innings });
  } else {
    res.send({ success: false, message: "Invalid match id." });
  }
});

const getTopBatsmen = async (matchId, team) => {
  const players = await query(
    "SELECT playerName, score, balls, isOut FROM players WHERE matchId = ? AND team = ? AND score != 0 ORDER BY score DESC LIMIT 4",
    [matchId, team]
  );
  return players;
};

const getTopBowler = async (matchId, team) => {
  const players = await query(
    "SELECT playerName, runsGiven, ballsBowled, wicketsTaken FROM players WHERE matchId = ? AND team = ? AND ballsBowled != 0 ORDER BY wicketsTaken DESC LIMIT 4",
    [matchId, team]
  );
  //For each player change the ballsBowled to oversBowled
  players.forEach((player) => {
    player.oversBowled = ballsToOvers(player.ballsBowled);
    delete player.ballsBowled;
  });
  console.log("players`: " + players);
  return players;
};

app.post("/api/getTopPlayers", async (req, res) => {
  const { matchId, team } = req.body;
  const topBatsmen = await getTopBatsmen(matchId, team);
  res.send({
    topBatsmen: topBatsmen ? topBatsmen : [],
    topBowlers: await getTopBowler(matchId, team),
  });
});

const getMatchResult = async (matchId) => {
  const match = await query("SELECT matchResult FROM matches WHERE id = ?", [
    matchId,
  ]);
  return match[0].matchResult;
};

app.post("/api/getMatchResult", async (req, res) => {
  const { matchId } = req.body;
  const result = await getMatchResult(matchId);
  res.send(result);
});

const showChoiceSelector = async (matchId, team) => {
  const currentBattingTeam = await getCurrentBattingTeam(matchId);
  if (currentBattingTeam === team) {
    const lastBall = await query(
      "SELECT * FROM balls WHERE matchId = ? ORDER BY id DESC LIMIT 1",
      [matchId]
    );
    console.log(
      "current batting team: " + currentBattingTeam,
      "lastBall: ",
      lastBall
    );
    if (
      lastBall.length === 0 ||
      lastBall[0].result !== null ||
      lastBall[0].batsman_choice === null
    ) {
      return { showChoiceSelector: true };
    } else {
      return { showChoiceSelector: false };
    }
  } else {
    const lastBall = await query(
      "SELECT * FROM balls WHERE matchId = ? ORDER BY id DESC LIMIT 1",
      [matchId]
    );
    if (
      lastBall.length === 0 ||
      lastBall[0].result !== null ||
      lastBall[0].bowler_choice === null
    ) {
      return { showChoiceSelector: true };
    } else {
      return { showChoiceSelector: false };
    }
  }
};

app.post("/api/showChoiceSelector", async (req, res) => {
  const { matchId, team } = req.body;
  res.send(await showChoiceSelector(matchId, team));
});

const textToNumnber = (text) => {
  if (text === "one") {
    return 1;
  } else if (text === "two") {
    return 2;
  } else if (text === "three") {
    return 3;
  } else if (text === "four") {
    return 4;
  } else if (text === "six") {
    return 6;
  } else if (text === "wicket") {
    return "W";
  } else if (text === "zero") {
    return 0;
  } else {
    return "";
  }
};

const getLastSixBalls = async (matchId) => {
  const currentBattingTeam = await getCurrentBattingTeam(matchId);
  console.log("currentBattingTeam: " + currentBattingTeam);
  const lastSixBalls = await query(
    "SELECT result FROM balls WHERE matchId = ? AND battingTeam = ? ORDER BY id DESC LIMIT 6",
    [matchId, currentBattingTeam]
  );
  const lastSixBallsArray = [];
  lastSixBalls.forEach((ball) => {
    lastSixBallsArray.push(textToNumnber(ball.result));
  });
  console.log("lastSixBalls: " + lastSixBallsArray);
  return lastSixBallsArray;
};

app.post("/api/getLastSixBalls", async (req, res) => {
  const { matchId, team } = req.body;
  res.send(await getLastSixBalls(matchId, team));
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server is running on 0.0.0.0:3000");
});
