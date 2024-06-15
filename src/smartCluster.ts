import { fork, ChildProcess } from "child_process";
import { nanoid } from "nanoid";

class Process {
  //For creating doubly linked list nodes for a process queue.
  //The doubly characteristic is for the goal of using a hashmap
  //to quickly reference nodes on their pid

  pid: number | null = null;
  next: Process | null = null;
  previous: Process | null = null;

  clearAll(): void {
    this.pid = null;
    this.previous = null;
    this.next = null;
  }
}

class ProcessQueue {
  #queueHead: Process | null = null;
  #queueTail: Process | null = null;
  #emptyProcessObjs: Process[] = [];
  #processesInQueue: Map<number, Process> = new Map<number, Process>();

  constructor(numOfProcesses: number) {
    for (let i = 0; i < numOfProcesses; i++) {
      this.#emptyProcessObjs.push(new Process());
    }
  }

  #collectProcessObj(process: Process): void {
    process.clearAll();
    this.#emptyProcessObjs.push(process);
  }

  //adds to the back of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  add(pid: number): void {
    if (typeof pid !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //since TS transpiles to JS, this ensures runtime safety
    }

    //get() is faster than has()
    if (this.#processesInQueue.get(pid)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that processes already in queue aren't added again
      //if this throws, this shows a larger logical error from the source using this api
    }

    const emptyProcessObj = this.#emptyProcessObjs.shift();

    if (!emptyProcessObj) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //if this throws, this shows a larger logical error from the source using this api
    }

    emptyProcessObj.pid = pid;

    if (!(this.#queueHead instanceof Process)) {
      this.#queueHead = this.#queueTail = emptyProcessObj;

      //queue length is 0
    } else {
      emptyProcessObj.previous = this.#queueTail;
      this.#queueTail!.next = emptyProcessObj;
      this.#queueTail = emptyProcessObj;

      //queue length >0
    }

    this.#processesInQueue.set(pid, emptyProcessObj);
  }

  //returns the front of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  shift(): number | null {
    if (!(this.#queueHead instanceof Process)) {
      return null;

      //if the queue is empty
      //However, don't throw an error, rather return null for control flow
    }

    const headNode = this.#queueHead;

    if (this.#queueHead === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //queue length of 1
    } else {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //queue length >1
    }

    const pid = headNode.pid;

    this.#processesInQueue.delete(pid as number);
    this.#collectProcessObj(headNode);

    return pid;
  }

  //determines how to alter the queue to remove he supplied process instance from such.
  remove(pid: number): void {
    if (typeof pid !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //since TS transpiles to JS, this ensures runtime safety
    }

    const process = this.#processesInQueue.get(pid);

    //get() is faster than has()
    if (!process) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that the process trying to be removed is actually in the queue
    }

    if (process === this.#queueHead && process === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //if the node is both the head and tail (queue length of 1)
    } else if (process === this.#queueHead) {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //if the node is the current head
    } else if (process === this.#queueTail) {
      this.#queueTail = this.#queueTail.previous;
      this.#queueTail!.next = null;

      //if the node is the current tail
    } else {
      process.previous!.next = process.next;
      process.next!.previous = process.previous;

      //if the node is in the middle of the queue
    }

    this.#processesInQueue.delete(pid);
    this.#collectProcessObj(process);
  }
}

class Task {
  id: string | null = null;
  next: Task | null = null;
  previous: Task | null = null;

  clearAll(): void {
    this.id = null;
    this.next = null;
    this.previous = null;
  }
}

//going to be similar to the process queue in terms of data structure used
class TaskQueue {
  #queueHead: Task | null = null;
  #queueTail: Task | null = null;

  #emptyTaskObjs: Task[] = [];
  #preallocObjs: number;
  #currObjs: number;
  #maxObjs: number;

  #tasksInQueue: Map<string, Task> = new Map<string, Task>();

  constructor(preallocObjs: number, maxObjs: number) {
    if (typeof preallocObjs !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (typeof maxObjs !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#preallocObjs = preallocObjs;
    this.#maxObjs = maxObjs;
  }

  #getTaskObj(): Task {
    if (this.#currObjs >= this.#maxObjs) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //in the case that the current number of task objects will exceed the max limit if another were to be created
    }

    if (this.#currObjs >= this.#preallocObjs) {
      const taskObj = new Task();

      this.#currObjs++;

      return taskObj;

      //in this case, create a new object that exceeds the prealloc limit, but not the max
    }

    //up to this point, means there must be empty task objects that can be used

    const taskObj = this.#emptyTaskObjs.shift();

    if (!taskObj) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //this shouldn't throw, but if it does, means there is something very wrong with the memory pooling logic
    }

    return taskObj;
  }

  #collectTaskObj(task: Task): void {
    task.clearAll();

    if (this.#currObjs > this.#preallocObjs) {
      this.#currObjs--;
    } else {
      this.#emptyTaskObjs.push(task);
    }
  }

  addToQueue(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    //get() is faster than has()
    if (this.#tasksInQueue.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    const taskObj = this.#getTaskObj();

    if (!this.#queueHead) {
      this.#queueHead = this.#queueTail = taskObj;

      //queue length is 0
    } else {
      taskObj.previous = this.#queueTail;
      this.#queueTail!.next = taskObj;
      this.#queueTail = taskObj;

      //queue length >0
    }

    this.#tasksInQueue.set(id, taskObj);
  }

  shiftFromQueue(): string | null {
    if (!(this.#queueHead instanceof Task)) {
      return null;

      //if the queue is empty
      //However, don't throw an error, rather return null for control flow
    }

    const headNode = this.#queueHead;

    if (this.#queueHead === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //queue length of 1
    } else {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //queue length >1
    }

    this.#tasksInQueue.delete(headNode.id as string);
    this.#collectTaskObj(headNode);

    return headNode.id;
  }

  removeFromQueue(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    const task = this.#tasksInQueue.get(id);

    if (!task) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (task === this.#queueHead && task === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //if the node is both the head and tail (queue length of 1)
    } else if (task === this.#queueHead) {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //if the node is the current head
    } else if (task === this.#queueTail) {
      this.#queueTail = this.#queueTail.previous;
      this.#queueTail!.next = null;

      //if the node is the current tail
    } else {
      task.previous!.next = task.next;
      task.next!.previous = task.previous;

      //if the node is in the middle of the queue
    }

    this.#tasksInQueue.delete(id);
    this.#collectTaskObj(task);
  }
}

class ProcessManager {}

class TaskManager {
  //for managing empty task objects and number of task objects present,
  //because options for defining preallocated tasks objects, as well as an upper limit to the
  //number of tasks that can exist in the queue will exist

  #taskLabels: Map<string, string> = new Map<string, string>();
  #taskArgs: Map<string, Array<any>> = new Map<string, Array<any>>();
  #queue: TaskQueue;

  constructor(preallocObjs: number, maxObjs: number) {
    if (preallocObjs < 0) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (maxObjs < preallocObjs) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#queue = new TaskQueue(preallocObjs, maxObjs);
  }

  //returns the id string corresponding to the created task
  createTask(taskLabel: string, args: Array<any>): string {
    if (typeof taskLabel !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!Array.isArray(args)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    let id: string;

    do {
      id = nanoid();

      //ensures no collision of IDs, even if the chance is really small
    } while (!this.#taskLabels.get(id)); //get() is faster than has()

    this.#taskLabels.set(id, taskLabel);
    this.#taskArgs.set(id, args);

    return id;
  }

  addToQueue(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    //get() is faster than has()
    if (!this.#taskLabels.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    //the task object supplied has to have all valid properties, and empty doubly pointers
    this.#queue.addToQueue(id);
  }

  getNextTaskId(): string | null {
    return this.#queue.shiftFromQueue();
  }

  deleteTask(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!this.#taskLabels.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#queue.removeFromQueue(id);
    this.#taskLabels.delete(id);
    this.#taskArgs.delete(id);
  }

  requeueTask(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!this.#taskLabels.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#queue.removeFromQueue(id);
    this.#queue.addToQueue(id);
  }

  getTaskLabel(id: string): string | null {
    const taskLabel = this.#taskLabels.get(id);

    return taskLabel ? taskLabel : null;
  }

  getArgs(id: string): Array<any> | null {
    const args = this.#taskArgs.get(id);

    return Array.isArray(args) ? [...args] : null; //return a clone of the array instead of the reference
  }
}

class SmartCluster {
  //for managing each task promise created, which these promises are delegated to the child processes,
  //automatically managing load balancing. The key is the arbitrary promise ID, and the value is the promise APIs resolve and reject.
  //The promise ID is passed to the child, paired with the task to execute. The child process passes this same promise ID back, which allows
  //messages to main process to be associated with specific promises.
  #messagePromises = new Map();

  #processQueue: ProcessQueue;
  #taskQueue: TaskQueue;

  constructor(
    pageSource: string,
    numOfProcesses: number,
    preallocObjs: number,
    maxallocObjs: number
  ) {}
}
