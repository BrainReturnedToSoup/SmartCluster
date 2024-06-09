import { fork, ChildProcess } from "child_process";

class Process {
  //For creating doubly linked list nodes for a process queue.
  //The doubly characteristic is for the goal of using a hashmap
  //to quickly reference nodes on their pid

  reference: ChildProcess | null = null;
  pid: number | null;
  next: Process | null = null;
  previous: Process | null = null;

  clearDoublyPointers(): void {
    this.previous = null;
    this.next = null;
  }

  clearAll(): void {
    this.reference = null;
    this.pid = null;
    this.previous = null;
    this.next = null;
  }
}

class ProcessQueue {
  #queueHead: Process | null = null;
  #queueTail: Process | null = null;
  #processesInQueue: Set<number> = new Set();

  //adds to the back of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  addToQueue(process: Process): void {
    if (!(process.reference instanceof ChildProcess)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure the process is a valid process, and not null
      //FATAL ERROR
    }

    if (typeof process.pid !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that the process instance has a valid PID, which is crucial for process tracking
      //FATAL ERROR
    }

    if (this.#processesInQueue.has(process.pid)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that processes already in queue aren't added again
      //FATAL ERROR
    }

    if (!(this.#queueHead instanceof Process)) {
      this.#queueHead = this.#queueTail = process;

      //queue length is 0
    } else {
      process.previous = this.#queueTail;
      this.#queueTail!.next = process;
      this.#queueTail = process;

      //queue length >0
    }

    this.#processesInQueue.add(process.pid);
  }

  //returns the front of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  shiftFromQueue(): Process | null {
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

    this.#processesInQueue.delete(headNode.pid as number);

    return headNode;
  }

  //determines how to alter the queue to remove he supplied process instance from such.
  removeFromQueue(process: Process): void {
    if (typeof process.pid !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that the process instance has a valid PID, which is crucial for process tracking
      //FATAL ERROR
    }

    if (!this.#processesInQueue.has(process.pid)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that the process trying to be removed is actually in the queue
      //FATAL ERROR
    }

    if (
      process === this.#queueHead &&
      process === this.#queueTail
    ) {
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

    this.#processesInQueue.delete(process.pid);
  }
}

class Task {
  instruction: string | null = null;
  payload: Array<any> | null = null; // array of arguments essentially
  id: number | null = null;
  next: Task | null = null;
  previous: Task | null = null;

  clearAll(): void {
    this.instruction = null;
    this.payload = null;
    this.id = null;
  }
}

//going to be similar to the process queue in terms of data structure used
class MessageQueue {
  #queueHead: Task | null = null;
  #queueTail: Task | null = null;
  #tasksInQueue: Set<number> = new Set<number>();

  addToQueue(task: Task): void {
    if (typeof task.id !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //FATAL ERROR
    }

    if (!Array.isArray(task.payload)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //FATAL ERROR
    }

    if (typeof task.instruction !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //FATAL ERROR
    }

    if (this.#tasksInQueue.has(task.id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //FATAL ERROR
    }

    if (!this.#queueHead) {
      this.#queueHead = this.#queueTail = task;

      //queue length is 0
    } else {
      task.previous = this.#queueTail;
      this.#queueTail!.next = task;
      this.#queueTail = task;

      //queue length >0
    }

    this.#tasksInQueue.add(task.id);
  }

  shiftFromQueue(): Task | null {
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

    this.#tasksInQueue.delete(headNode.id as number);

    return headNode;
  }

  removeFromQueue(task: Task): void {
    if (typeof task.id !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //FATAL ERROR
    }

    if (!this.#tasksInQueue.has(task.id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //FATAL ERROR
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

    this.#tasksInQueue.delete(task.id);
  }
}

class SmartCluster {
  //for managing each task promise created, which these promises are delegated to the child processes,
  //automatically managing load balancing. The key is the arbitrary promise ID, and the value is the promise APIs resolve and reject.
  //The promise ID is passed to the child, paired with the task to execute. The child process passes this same promise ID back, which allows
  //messages to main process to be associated with specific promises.
  #messagePromises = new Map();

  //for managing each valid process object, which contains the actual process reference internally,
  //as well as the doubly pointers used in the process queue.
  #processInstanceMap = new Map<number, Process>();
  #emptyProcessInstances: Process[] = [];

  //for managing empty task objects and number of task objects present,
  //because options for defining preallocated tasks objects, as well as an upper limit to the
  //number of tasks that can exist in the queue will exist
  #taskInstanceMap = new Map();
  #emptyTaskInstances: Task[] = [];
  #numOfTaskObjs: number = 0;

  constructor(pageSource: string, numOfProcesses: number) {}
}
