import "./helpers/date-utils";
import { EOL } from "os";
import "./helpers/number-utils";
import { LinkEx } from "./helpers/link-utils";
import { Scheduler, SimpleScheduler, AFactorScheduler, IterationScheduler } from "./scheduler";
import IW from "./main";
import { GrayMatterFile } from "gray-matter";
import { LogTo } from "./logger";
import { markdownTable } from "markdown-table";

export class MarkdownTable {
  plugin: IW;
  private header = ["Link", "Priority", "Notes", "Interval", "Next Rep"];
  rows: MarkdownTableRow[] = [];
  removedDeleted: boolean = false;

  // TODO: just pass the gray matter object, replace text with contents.
  constructor(plugin: IW, frontMatter?: GrayMatterFile<string>, text?: string) {
    this.plugin = plugin;
    if (text) {
      text = text.trim();
      let split = text.split(/\r?\n/);
      let idx = this.findYamlEnd(split);
      if (idx !== -1)
        // line after yaml + header
        this.rows = this.parseRows(split.slice(idx + 1 + 2));
    }
  }

  removeDeleted() {
    let queuePath = this.plugin.queue.queuePath;
    let exists = this.rows.filter((r) =>
      this.plugin.links.exists(r.link, queuePath)
    );
    let removedNum = this.rows.length - exists.length;
    this.rows = exists;
    if (removedNum > 0) {
      this.removedDeleted = true;
      LogTo.Console(`Removed ${removedNum} reps with non-existent links.`);
    }
  }

  hasRowWithLink(link: string) {
    link = LinkEx.removeBrackets(link);
    return this.rows.some((r) => r.link === link);
  }

  findYamlEnd(split: string[]) {
    let ct = 0;
    let idx = split.findIndex((value) => {
      if (value === "---") {
        if (ct === 1) {
          return true;
        }
        ct += 1;
        return false;
      }
    });

    return idx;
  }

  parseRows(arr: string[]): MarkdownTableRow[] {
    return arr.map((v) => this.parseRow(v));
  }

  parseRow(text: string): MarkdownTableRow {
    let arr = text
      .substr(1, text.length - 1)
      .split("|")
      .map((r) => r.trim());

    if(this.scheduler instanceof AfactorSchedulerTableRow) {
      return new AfactorSchedulerTableRow(
        arr[0],
        Number(arr[1]),
        arr[2],
        Number(arr[3]),
        new Date(arr[4])
      );
    } else if (this.scheduler instanceof SimpleSchedulerTableRow) {
      return new SimpleSchedulerTableRow(
        arr[0],
        Number(arr[1]),
        arr[2],
        Number(arr[3]),
        new Date(arr[4])
      );
    } else if (this.scheduler instanceof IterationSchedulerTableRow) {
      return new IterationSchedulerTableRow(
        arr[0],
        Number(arr[1]),
        arr[2],
        arr[3],
        new Date(arr[4])
      );
    } else {
      LogTo.Console("Unknown scheduler instance type!!!", true);
    }
  }

  hasReps() {
    return this.rows.length > 0;
  }

  currentRep() {
    this.sortReps();
    return this.rows[0];
  }

  nextRep() {
    this.sortReps();
    return this.rows[1];
  }

  removeCurrentRep() {
    this.sortReps();
    let removed;
    if (this.rows.length === 1) {
      removed = this.rows.pop();
    } else if (this.rows.length > 1) {
      removed = this.rows[0];
      this.rows = this.rows.slice(1);
    }
    return removed;
  }

  sortReps() {
    this.sortByPriority();
    this.sortByDue();
  }

  getReps() {
    return this.rows;
  }

  private sortByDue() {
    this.rows.sort((a, b) => {
      if (a.isDue() && !b.isDue()) return -1;
      if (a.isDue() && b.isDue()) return 0;
      if (!a.isDue() && b.isDue()) return 1;
    });
  }

  private sortByPriority() {
    this.rows.sort((a, b) => {
      let fst = +a.priority;
      let snd = +b.priority;
      if (fst > snd) return 1;
      else if (fst == snd) return 0;
      else if (fst < snd) return -1;
    });
  }

  appendRow(row: MarkdownTableRow) {
    this.rows.push(row);
  }

  sort(compareFn: (a: MarkdownTableRow, b: MarkdownTableRow) => number) {
    if (this.rows) this.rows = this.rows.sort(compareFn);
  }

  toString() {
    const rows = this.toArray();
    if (rows && rows.length > 0) {
      const align = { align: ["l", "r", "l", "r", "r"] };
      return [markdownTable([this.header, ...rows], align)]
        .join(EOL)
        .trim();
    } else {
      return '';
    }
  }

  toArray() {
    return this.rows.map((x) => x.toArray());
  }
}

export abstract class MarkdownTableRow {
  public link: string;
  public priority: number;
  public notes: string;

  constructor(link: string, priority: number, notes: string) {
    this.link = link;
    this.priority = priority;
    this.notes = notes;
  }

  abstract isDue(): boolean;
  abstract toArray(): string[];
}

export class AfactorSchedulerTableRow extends MarkdownTableRow {  
  interval: number;
  nextRepDate: Date;

  constructor(
    link: string,
    priority: number,
    notes: string,
    interval: number = 1,
    nextRepDate: Date = new Date("1970-01-01")
  ) {
    let tLink = LinkEx.removeBrackets(link);
    let tPriority = priority.isValidPriority() ? priority : 30;
    let tNotes = notes.replace(/(\r\n|\n|\r|\|)/gm, "");

    super(tLink, tPriority, tNotes);

    this.interval = interval.isValidInterval() ? interval : 1;
    this.nextRepDate = nextRepDate.isValid()
      ? nextRepDate
      : new Date("1970-01-01");
  }

  isDue(): boolean {
    return new Date(Date.now()) >= this.nextRepDate;
  }

  toArray() {
    return [
      LinkEx.addBrackets(this.link),
      this.priority.toString(),
      this.notes,
      this.interval.toString(),
      this.nextRepDate.formatYYMMDD(),
    ];
  }
}

export class SimpleSchedulerTableRow extends MarkdownTableRow {
  interval: number;
  nextRepDate: Date;

  constructor(
    link: string,
    priority: number,
    notes: string,
    interval: number = 1,
    nextRepDate: Date = new Date("1970-01-01")
  ) {
    let tLink = LinkEx.removeBrackets(link);
    let tPriority = priority.isValidPriority() ? priority : 30;
    let tNotes = notes.replace(/(\r\n|\n|\r|\|)/gm, "");

    super(tLink, tPriority, tNotes);

    this.interval = interval.isValidInterval() ? interval : 1;
    this.nextRepDate = nextRepDate.isValid()
      ? nextRepDate
      : new Date("1970-01-01");
  }

  isDue(): boolean {
    return new Date(Date.now()) >= this.nextRepDate;
  }

  toArray() {
    return [
      LinkEx.addBrackets(this.link),
      this.priority.toString(),
      this.notes,
      this.interval.toString(),
      this.nextRepDate.formatYYMMDD(),
    ];
  }
}

export class IterationSchedulerTableRow extends MarkdownTableRow {
  iteration: string;
  lastReadDate: Date;

  constructor(
    link: string,
    priority: number,
    notes: string,
    iteration: string = '',
    lastReadDate: Date = new Date("1970-01-01")
  ) {
    let tLink = LinkEx.removeBrackets(link);
    let tPriority = priority.isValidPriority() ? priority : 30;
    let tNotes = notes.replace(/(\r\n|\n|\r|\|)/gm, "");

    super(tLink, tPriority, tNotes);

    this.iteration = iteration;
    this.lastReadDate = lastReadDate;
  }

  isDue(): boolean {
    return true;
  }

  toArray() {
    return [
      LinkEx.addBrackets(this.link),
      this.priority.toString(),
      this.notes,
      this.iteration,
      this.lastReadDate.formatYYMMDD(),
    ];
  }
}
