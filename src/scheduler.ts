import { AfactorSchedulerTableRow, IterationSchedulerTableRow, MarkdownTable, MarkdownTableRow } from "./markdown";
import "./helpers/date-utils";
import "./helpers/number-utils";
import { LogTo } from "./logger";

export abstract class Scheduler {
  protected name: string;
  constructor(name: string) {
    this.name = name;
  }

  abstract schedule(table: MarkdownTable, row: MarkdownTableRow): void;
}

export class SimpleScheduler extends Scheduler {
  constructor() {
    super("simple");
  }

  schedule(table: MarkdownTable, row: MarkdownTableRow) {
    LogTo.Console("schedule: " + row.link);
    table.appendRow(row);
    // spread rows between 0 and 100 priority
    let step = 99.9 / table.rows.length;
    let curPri = step;
    for (let row of table.rows) {
      row.priority = curPri.round(2);
      curPri += step;
    }
  }

  toString() {
    return `---
scheduler: "${this.name}"
---`;
  }
}

export class IterationScheduler extends Scheduler {
  private iteration: string;

  constructor(iteration: string = '') {
    super("iteration");
    this.iteration = iteration;
  }

  schedule(table: MarkdownTable, row: MarkdownTableRow) {
    if(row instanceof IterationSchedulerTableRow) {
      let newRow = row as IterationSchedulerTableRow;
      LogTo.Console("Iteration schedule: " + row.link);
      newRow.iteration = this.iteration;
      newRow.lastReadDate = new Date();
      table.appendRow(newRow);
      // spread rows between 0 and 100 priority
      let step = 99.9 / table.rows.length;
      let curPri = step;
      for (let row of table.rows) {
        row.priority = curPri.round(2);
        curPri += step;
      }
    } else {
      LogTo.Console("Table Row - type incorrect!!", true);
    }
  }

  toString() {
    return `---
scheduler: "${this.name}"
iteration: "Test"
---`;
  }
}

export class AFactorScheduler extends Scheduler {
  private afactor: number;
  private interval: number;

  constructor(afactor: number = 2, interval: number = 1) {
    super("afactor");
    this.afactor = afactor.isValidAFactor() ? afactor : 2;
    this.interval = interval.isValidInterval() ? interval : 1;
  }

  schedule(table: MarkdownTable, row: MarkdownTableRow) {
    if(row instanceof AfactorSchedulerTableRow) {
      let newRow = row as AfactorSchedulerTableRow;
      newRow.nextRepDate = new Date().addDays(row.interval);
      newRow.interval = this.afactor * newRow.interval;
      table.appendRow(newRow);
    }
  }

  toString() {
    return `---
scheduler: "${this.name}"
afactor: ${this.afactor}
interval: ${this.interval}
---`;
  }
}
