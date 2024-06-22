import { fork, ChildProcess } from "child_process";
import { nanoid } from "nanoid";

class Process {
  //For creating doubly linked list nodes for a process queue.
  //The doubly characteristic is for the goal of using a hashmap
  //to quickly reference nodes on their pid

  id: string | null = null;
  next: Process | null = null;
  previous: Process | null = null;

  clearAll(): void {
    this.id = null;
    this.previous = null;
    this.next = null;
  }
}

class ProcessQueue {
  #queueHead: Process | null = null;
  #queueTail: Process | null = null;
  #emptyProcessObjs: Process[] = [];
  #processesInQueue: Map<string, Process> = new Map<string, Process>();

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
  add(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //since TS transpiles to JS, this ensures runtime safety
    }

    //get() is faster than has()
    if (this.#processesInQueue.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that processes already in queue aren't added again
      //if this throws, this shows a larger logical error from the source using this api
    }

    const emptyProcessObj = this.#emptyProcessObjs.shift();

    if (!emptyProcessObj) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //if this throws, this shows a larger logical error from the source using this api
    }

    emptyProcessObj.id = id;

    if (!(this.#queueHead instanceof Process)) {
      this.#queueHead = this.#queueTail = emptyProcessObj;

      //queue length is 0
    } else {
      emptyProcessObj.previous = this.#queueTail;
      this.#queueTail!.next = emptyProcessObj;
      this.#queueTail = emptyProcessObj;

      //queue length >0
    }

    this.#processesInQueue.set(id, emptyProcessObj);
  }

  //returns the front of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  shift(): string | null {
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

    const id = headNode.id;

    this.#processesInQueue.delete(id as string);
    this.#collectProcessObj(headNode);

    return id;
  }

  //determines how to alter the queue to remove he supplied process instance from such.
  remove(id: string): void {
    if (typeof id !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //since TS transpiles to JS, this ensures runtime safety
    }

    const process = this.#processesInQueue.get(id);

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

    this.#processesInQueue.delete(id);
    this.#collectProcessObj(process);
  }
}

class ProcessManager {
  #childProcesses: Map<string, ChildProcess> = new Map<string, ChildProcess>();
  #processQueue: ProcessQueue;

  constructor(numOfProcesses: number = 0) {
    if (typeof numOfProcesses !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (numOfProcesses <= 0) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#processQueue = new ProcessQueue(numOfProcesses);
  }

  #subscriber: Function | null = null;

  #emit(
    event: string,
    processId: string,
    message: Object | null = null,
    code: number | null = null,
    signal: string | number | null = null
  ) {
    if (typeof this.#subscriber !== "function") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#subscriber(event, processId, message, code, signal);
  }

  subscribe(subFunc: Function) {
    this.#subscriber = subFunc;
  }

  #initChildProcess(processId: string, pageSource: string): Promise<any> {
    const managerScope = this;

    return new Promise((resolve, reject) => {
      const childProcess = fork(pageSource);

      childProcess.on("exit", (code, signal) => {
        managerScope.#processQueue.remove(processId);

        managerScope.#childProcesses.delete(processId);

        this.#emit("exit", processId, null, code, signal);

        //emit the event to alert the parent class 'SmartCluster' that a process exited, and to thus
        //invoke the necessary apis for process and task recovery.
      });

      childProcess.on("error", (err) => {
        reject(err);

        //app breaking exception
      });

      childProcess.on("message", (message) => {
        this.#emit("message", processId, message, null, null);

        //emit the event to alert the parent class 'SmartCluster' that the process finished a task, and to
        //thus invoke the necessary apis to either send the process on the next available task, or to add the process
        //to the process queue
      });

      childProcess.on("spawn", () => {
        managerScope.#childProcesses.set(processId, childProcess);

        this.#emit("spawn", processId, null, null, null);
        //emit the event to alert the parent class 'SmartCluster' that the process has spawned completely and is ready to
        //be used, and to thus invoke the necessary apis to either give the new process a task, or to add the process to the
        //process queue.

        resolve(null); //resolves the ovearching promise, which is important for child process initialization.
      });
    });
  }

  async createProcess(pageSource: string) {
    if (typeof pageSource !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    let processId: string;

    do {
      processId = nanoid();

      //ensures no collision of IDs, even if the chance is really small
    } while (!this.#childProcesses.get(processId)); //get() is faster than has()

    await this.#initChildProcess(processId, pageSource);

    return processId;
  }

  addToQueue(processId: string): void {
    if (typeof processId !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!this.#childProcesses.get(processId)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#processQueue.add(processId);
  }

  getNextProcessId(): string | null {
    return this.#processQueue.shift();

    //if an ID is returned, it was removed from the queue on the shift
  }

  killProcess(processId: string): void {
    if (typeof processId !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    const process = this.#childProcesses.get(processId);

    if (!process) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    process.kill();
  }

  sendToProcess(
    processId: string,
    taskId: string,
    taskLabel: string,
    args: Array<any>
  ): void {
    if (typeof processId !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (typeof taskLabel !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!Array.isArray(args)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    const childProcess = this.#childProcesses.get(processId);

    if (!childProcess) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    childProcess.send({ taskId, taskLabel, args });
  }
}

class Task {
  id: string | null = null;
  prealloc: boolean;

  next: Task | null = null;
  previous: Task | null = null;

  constructor(preallocFlag: boolean) {
    this.prealloc = preallocFlag;
  }

  clearIdAndPointers(): void {
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
  #maxObjs: number;
  #currObjs: number = 0;

  #tasksInQueue: Map<string, Task> = new Map<string, Task>();

  constructor(preallocObjs: number = 0, maxObjs: number = 0) {
    if (typeof preallocObjs !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (typeof maxObjs !== "number") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#preallocObjs = preallocObjs;
    this.#maxObjs = maxObjs;

    for (let i = 0; i < this.#preallocObjs; i++) {
      this.#emptyTaskObjs.push(new Task(true));
      this.#currObjs++;
    }
  }

  #getTaskObj(): Task {
    if (this.#currObjs >= this.#maxObjs) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //in the case that the current number of task objects will exceed the max limit if another were to be created.
    }

    const retrieved = this.#emptyTaskObjs.shift();

    if (retrieved) {
      return retrieved;

      //in this case, means there is a free task object to use from the empty task pool, which can
      //happen if there are only prealloc objects to use, or if a prealloc object was returned after use
      //while the current object value is above the prealloc value, but not the max limit.
    } else {
      const created = new Task(false);

      this.#currObjs++;

      return created;

      //in this case, create a new object that exceeds the prealloc limit, but not the max, because there aren't
      //any task objects that can be reused at this point.
    }
  }

  #collectTaskObj(task: Task): void {
    if (!(task instanceof Task)) {
      throw new Error();
    }

    task.clearIdAndPointers();

    if (task.prealloc) {
      this.#emptyTaskObjs.push(task);

      //means the task object supplied was an original preallocated object, so return
      //it to the empty task object array for a better chance at cache locality optimization.
    } else {
      this.#currObjs--;
      //means the current objects value has to be greater than the preallocated objects value
    }
  }

  add(id: string): void {
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

  shift(): string | null {
    if (!(this.#queueHead instanceof Task)) {
      return null;

      //if the queue is empty
      //However, don't throw an error, rather return null for control flow
    }

    const head = this.#queueHead;

    if (this.#queueHead === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //queue length of 1
    } else {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //queue length >1
    }

    this.#tasksInQueue.delete(head.id as string);
    this.#collectTaskObj(head);

    return head.id;
  }

  remove(id: string): void {
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

class TaskManager {
  //for managing empty task objects and number of task objects present,
  //because options for defining preallocated tasks objects, as well as an upper limit to the
  //number of tasks that can exist in the queue will exist

  #taskLabels: Map<string, string> = new Map<string, string>();
  #taskArgs: Map<string, Array<any>> = new Map<string, Array<any>>();
  #taskQueue: TaskQueue;

  constructor(preallocObjs: number, maxObjs: number) {
    if (preallocObjs < 0) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (maxObjs < preallocObjs) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#taskQueue = new TaskQueue(preallocObjs, maxObjs);
  }

  //returns the id string corresponding to the created task
  createTask(taskLabel: string, args: Array<any>): string {
    if (typeof taskLabel !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!Array.isArray(args)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    let taskId: string;

    do {
      taskId = nanoid();

      //ensures no collision of IDs, even if the chance is really small
    } while (!this.#taskLabels.get(taskId)); //get() is faster than has()

    this.#taskLabels.set(taskId, taskLabel);
    this.#taskArgs.set(taskId, args);

    return taskId;
  }

  addToQueue(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    //get() is faster than has()
    if (!this.#taskLabels.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    //the task added to queue cannot already exist within the queue
    this.#taskQueue.add(id);
  }

  getNextTaskId(): string | null {
    //if an ID is returned, it was removed from the queue on the shift
    return this.#taskQueue.shift();
  }

  deleteTask(id: string): void {
    if (typeof id !== "string") {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    if (!this.#taskLabels.get(id)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#taskQueue.remove(id);
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

    this.#taskQueue.remove(id);
    this.#taskQueue.add(id);
  }

  getTaskLabel(id: string): string | null {
    const taskLabel = this.#taskLabels.get(id);

    return taskLabel ? taskLabel : null;
  }

  getTaskArgs(id: string): Array<any> | null {
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

  //stores important related to each process, and what task they are currently handling.
  #processIdToTaskId: Map<string, string> = new Map<string, string>();

  constructor(
    pageSource: string,
    numOfProcesses: number,
    preallocObjs: number,
    maxallocObjs: number
  ) {}
}
