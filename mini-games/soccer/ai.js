/* TienHub Soccer 5v5 - AI brain v7
 * Natural 5v5 movement: support runs, defensive shape, slower reactions,
 * one player contests the ball at a time, and teammates keep moving.
 */
(() => {
  'use strict';

  class SoccerAI {
    constructor(field) {
      this.field = field;
      this.memory = new Map();
    }

    state(p) {
      if (!this.memory.has(p.id)) {
        this.memory.set(p.id, {
          thinkIn: 0.12 + Math.random() * 0.12,
          lastTarget: { x: p.x, y: p.y },
          phase: Math.random() * Math.PI * 2,
          lastAction: 0
        });
      }
      return this.memory.get(p.id);
    }

    reset(players) {
      this.memory.clear();
      players.forEach(p => this.state(p));
    }

    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    nearest(list, from, filter = () => true) {
      let best = null;
      let bestD = Infinity;
      for (const p of list) {
        if (!filter(p)) continue;
        const d = this.distance(from, p);
        if (d < bestD) { best = p; bestD = d; }
      }
      return best;
    }

    ballShift(value, center, amount) {
      return this.clamp((value - center) * amount, -170, 170);
    }

    update(p, dt, ctx) {
      const s = this.state(p);
      s.thinkIn -= dt;

      // Humans do not make a perfect decision every frame. Re-think roughly
      // 6-8 times per second, while the movement itself stays smooth.
      if (s.thinkIn > 0) return { ...s.lastTarget, action: null };
      s.thinkIn = 0.13 + Math.random() * 0.11;

      const { players, ball, controlled, passRequestFor } = ctx;
      const teammates = players.filter(q => q.team === p.team && q !== p);
      const opponents = players.filter(q => q.team !== p.team);
      const direction = p.team === 'blue' ? 1 : -1;
      const ownGoalX = p.team === 'blue' ? 70 : this.field.w - 70;
      const enemyGoalX = p.team === 'blue' ? this.field.w - 20 : 20;
      const centerX = this.field.w / 2;
      const centerY = this.field.h / 2;
      const ballTeam = ball.owner?.team || null;
      const humanWantsBall = passRequestFor === p.team && controlled && controlled.team === p.team;

      let tx = p.home[0];
      let ty = p.home[1];
      let action = null;

      // ------------------------------------------------------------------
      // AI HAS THE BALL
      // ------------------------------------------------------------------
      if (ball.owner === p) {
        const goalDist = Math.abs(enemyGoalX - p.x);
        const inFinalThird = direction === 1 ? p.x > this.field.w * .68 : p.x < this.field.w * .32;
        const nearGoal = goalDist < 430 && Math.abs(p.y - centerY) < 245;

        if (humanWantsBall && controlled !== p) {
          action = 'pass-human';
          tx = controlled.x;
          ty = controlled.y;
        } else if (nearGoal || (inFinalThird && this.openShot(p, opponents, enemyGoalX))) {
          action = 'shoot';
          tx = p.x + direction * 120;
          ty = this.clamp(centerY + (p.y - centerY) * .35, 180, this.field.h - 180);
        } else {
          const target = this.bestPassTarget(p, teammates, opponents, direction);
          // AI should carry the ball forward by default. Passing is reserved
          // for a teammate who is clearly ahead and in useful space; this
          // prevents the five players from endlessly recycling the ball.
          if (target && ((target.x - p.x) * direction) > 115) {
            action = 'pass';
            tx = target.x;
            ty = target.y;
          } else {
            action = null;
            tx = p.x + direction * 210;
            ty = this.clamp(p.y + (centerY - p.y) * .10, 105, this.field.h - 105);
          }
        }
        return this.commit(s, tx, ty, action);
      }

      // ------------------------------------------------------------------
      // OPPONENT HAS THE BALL
      // ------------------------------------------------------------------
      if (ballTeam && ballTeam !== p.team) {
        const ownAttackers = players.filter(q => q.team === p.team && q.role !== 'defend');
        const pressTarget = this.nearest(ownAttackers, ball.owner);
        const isPress = p === pressTarget;

        if (isPress) {
          // Only ONE attacker presses. This prevents the two teams from
          // magnetically piling onto the ball.
          tx = ball.owner.x;
          ty = ball.owner.y;
        } else if (p.role === 'defend') {
          // Defender follows the dangerous side but keeps a realistic gap.
          const danger = Math.abs(ball.owner.x - ownGoalX) < 650;
          tx = danger ? ownGoalX + direction * 185 : p.home[0] + this.ballShift(ball.x, centerX, .16);
          ty = danger
            ? this.clamp(ball.owner.y, 175, this.field.h - 175)
            : p.home[1] + this.ballShift(ball.y, p.home[1], .18);
        } else {
          // Second attacker marks a passing lane instead of chasing the ball.
          const laneX = centerX + direction * 250;
          tx = laneX + this.ballShift(ball.x, centerX, .12);
          ty = p.home[1] + this.ballShift(ball.y, p.home[1], .22);
        }
        return this.commit(s, tx, ty, null);
      }

      // ------------------------------------------------------------------
      // TEAM-MATE HAS THE BALL
      // ------------------------------------------------------------------
      if (ballTeam === p.team) {
        const carrier = ball.owner;
        const attackers = teammates.filter(q => q.role !== 'defend');

        if (p.role === 'defend') {
          // The defender is not frozen: step up behind the attack and shift
          // side-to-side with the ball.
          const supportX = carrier.x - direction * 210;
          tx = this.clamp(supportX, 160, this.field.w - 160);
          ty = this.clamp(centerY + (carrier.y - centerY) * .58, 145, this.field.h - 145);
        } else {
          // Give each attacker a different lane. They continually move even
          // when the human is standing still, which feels much more like 5v5.
          const index = attackers.indexOf(p);
          const laneSide = index % 2 === 0 ? -1 : 1;
          const forward = 240 + index * 55;
          tx = carrier.x + direction * forward;
          ty = this.clamp(carrier.y + laneSide * 175, 100, this.field.h - 100);

          // Do not let an attacker run behind the goal line or too deep.
          if (direction === 1) tx = Math.min(tx, this.field.w - 130);
          else tx = Math.max(tx, 130);
        }
        return this.commit(s, tx, ty, null);
      }

      // ------------------------------------------------------------------
      // BALL IS FREE
      // ------------------------------------------------------------------
      const ownPlayers = players.filter(q => q.team === p.team);
      const chaseCandidates = ownPlayers.filter(q => q.role !== 'defend');
      const chaser = this.nearest(chaseCandidates, ball);

      if (p === chaser) {
        tx = ball.x;
        ty = ball.y;
      } else if (p.role === 'defend') {
        // Defender moves with the ball but does not race across the entire
        // pitch for it.
        const inDangerSide = direction === 1
          ? ball.x < this.field.w * .46
          : ball.x > this.field.w * .54;
        tx = inDangerSide
          ? ownGoalX + direction * 185
          : p.home[0] + this.ballShift(ball.x, centerX, .18);
        ty = inDangerSide
          ? this.clamp(ball.y, 175, this.field.h - 175)
          : p.home[1] + this.ballShift(ball.y, p.home[1], .18);
      } else {
        // Supporting attacker keeps moving into space while another teammate
        // contests the loose ball.
        const index = chaseCandidates.indexOf(p);
        const side = index % 2 === 0 ? -1 : 1;
        tx = p.home[0] + direction * this.ballShift(ball.x, centerX, .32);
        ty = this.clamp(p.home[1] + this.ballShift(ball.y, centerY, .28) + side * 75, 90, this.field.h - 90);
      }

      return this.commit(s, tx, ty, null);
    }

    commit(s, tx, ty, action) {
      s.lastTarget.x = tx;
      s.lastTarget.y = ty;
      return { x: tx, y: ty, action };
    }

    openShot(p, opponents, goalX) {
      const laneY = this.field.h / 2;
      for (const o of opponents) {
        if (Math.abs(o.y - laneY) < 75 &&
            Math.sign(o.x - p.x) === Math.sign(goalX - p.x) &&
            Math.abs(o.x - p.x) < 210) return false;
      }
      return true;
    }

    bestPassTarget(p, teammates, opponents, direction) {
      let best = null;
      let bestScore = -Infinity;
      for (const mate of teammates) {
        const d = this.distance(p, mate);
        if (d > 680 || d < 70) continue;
        const forward = (mate.x - p.x) * direction;
        if (forward < 95) continue;
        const pressure = Math.min(...opponents.map(o => this.distance(mate, o)), 999);
        const centrality = 120 - Math.abs(mate.y - this.field.h / 2) * .15;
        const score = forward * 1.45 + pressure * .82 + centrality - d * .34;
        if (score > bestScore) { bestScore = score; best = mate; }
      }
      return best;
    }
  }

  window.TienHubSoccerAI = SoccerAI;
})();
