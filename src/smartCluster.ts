import { fork, ChildProcess } from "child_process";

class ProcessInstance {
  //For creating doubly linked list nodes for a process queue.
  //The doubly characteristic is for the goal of using a hashmap
  //to quickly reference nodes on their pid

  processReference: ChildProcess | null = null;
  pid: number | null;
  next: ProcessInstance | null = null;
  previous: ProcessInstance | null = null;

  constructor(processReference: ChildProcess) {
    this.processReference = processReference;
  }

  wipeDoublyPointers(): void {
    this.previous = null;
    this.next = null;
  }

  wipeAll(): void {
    this.processReference = null;
    this.pid = null;
    this.previous = null;
    this.next = null;
  }
}

class ProcessQueue {
  #queueHead: ProcessInstance | null = null;
  #queueTail: ProcessInstance | null = null;
  #processesInQueue: Set<number> = new Set();

  //adds to the back of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  addToQueue(processInstance: ProcessInstance): void {
    if (typeof processInstance.pid !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //a simple check to ensure that the process instance has a valid PID, which is crucial for process tracking
    }

    if (this.#processesInQueue.has(processInstance.pid)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //a simple check to ensure that processes already in queue aren't added again
    }

    if (this.#queueHead === null) {
      this.#queueHead = this.#queueTail = processInstance;

      //if the queue is empty
    } else {
      processInstance.previous = this.#queueTail;
      this.#queueTail!.next = processInstance;
      this.#queueTail = processInstance;

      //if the queue is not empty
    }

    this.#processesInQueue.add(processInstance.pid);
  }

  //returns the front of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  shiftFromQueue(): ProcessInstance {
    if (this.#queueHead === null) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //if the queue head is null, this means the queue tail is null, meaning the queue is empty
    }

    const headNode = this.#queueHead;

    if (this.#queueHead === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //if the node is the only node in queue
    } else if (this.#queueHead.next === this.#queueTail) {
      this.#queueHead = this.#queueTail = this.#queueHead.next;
      this.#queueHead!.previous = this.#queueHead!.next = null;

      //if the queue length is of length 2 tail becomes new head and tail
    } else {
      this.#queueHead = this.#queueHead.next;

      //the queue length is >2
    }

    return headNode;
  }

  //determines how to alter the queue to remove he supplied process instance from such.
  removeFromQueue(processInstance: ProcessInstance): void {
    if (typeof processInstance.pid !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //a simple check to ensure that the process instance has a valid PID, which is crucial for process tracking
    }

    if (!this.#processesInQueue.has(processInstance.pid)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //a simple check to ensure that the process trying to be removed is actually in the queue
    }

    if (this.#queueHead === null && this.#queueTail === null) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //if the queue is empty, thus it is impossible to delete from the queue
    }

    if (
      processInstance === this.#queueHead &&
      processInstance === this.#queueTail
    ) {
      this.#queueHead = this.#queueTail = null;

      //if the node is the only node of the queue
    } else if (processInstance === this.#queueHead) {
      this.#queueHead = this.#queueHead.next;

      if (this.#queueHead) {
        this.#queueHead.previous = null;
      }

      //if the node is the current head
    } else if (processInstance === this.#queueTail) {
      this.#queueTail = this.#queueTail.previous;

      if (this.#queueTail) {
        this.#queueTail.next = null;
      }

      //if the node is the current tail
    } else {
      processInstance.previous!.next = processInstance.next;
      processInstance.next!.previous = processInstance.previous; //exclamation points asserts a value being present for the target properties, mainly for TS

      //if the node is in the middle of the queue
    }

    this.#processesInQueue.delete(processInstance.pid);
  }
}

class Task {
  #instruction: string | null = null;
  #payload: Object | null = null;
  #id: number | null = null;
}

class MessageQueue {
  #queue: Task[] = [];
  #tasksInQueue: Set<number> = new Set<number>();
}

class SmartCluster {
  //for managing each task promise created, which these promises are delegated to the child processes,
  //automatically managing load balancing. The key is the arbitrary promise ID, and the value is the promise APIs resolve and reject.
  //The promise ID is passed to the child, paired with the task to execute. The child process passes this same promise ID back, which allows
  //messages to main process to be associated with specific promises.
  #messagePromises = new Map();

  //for managing each valid process object, which contains the actual process reference internally,
  //as well as the doubly pointers used in the process queue.
  #processInstanceMap = new Map<number, ProcessInstance>();
  #emptyProcessInstances: ProcessInstance[] = [];

  //for managing empty task objects and number of task objects present,
  //because options for defining preallocated tasks objects, as well as an upper limit to the
  //number of tasks that can exist in the queue will exist
  #emptyTaskInstances: Task[] = [];
  #numOfTaskObjs: number = 0;

  constructor(pageSource: string, numOfProcesses: number) {}
}
