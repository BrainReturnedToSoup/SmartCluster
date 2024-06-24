import { fork, ChildProcess, Serializable } from "child_process";
import { nanoid } from "nanoid";

//mainly to catch logic-breaking type checking. This is not to be used for error-driven
//control flow, rather to help debugging the automata state chances due to high specificity errors per error
function checkType(arg: any, type: string): void {
  const callbacks: Record<string, () => void> = {
    string: (): void => {
      if (typeof arg !== "string") {
        throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
      }
    },

    positiveInteger: (): void => {
      if (typeof arg !== "number" || arg <= 0 || Math.floor(arg) !== arg) {
        throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
      }
    },

    function: (): void => {
      if (typeof arg !== "function") {
        throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
      }
    },

    array: (): void => {
      if (!Array.isArray(arg)) {
        throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
      }
    },
  };

  if (!callbacks[type]) {
    throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
  }

  callbacks[type]();
}

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
    checkType(numOfProcesses, "positiveInteger");

    for (let i = 0; i < numOfProcesses; i++) {
      this.#emptyProcessObjs.push(new Process());
    }
  }

  #collectProcessObj(process: Process): void {
    if (!(process instanceof Process)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    process.clearAll();
    this.#emptyProcessObjs.push(process);
  }

  //adds to the back of the queue, while also altering the head and tail pointers, as well as
  //the individual process instance previous and next pointers based on necessity.
  add(id: string): void {
    checkType(id, "string");

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
      //because there is a mismatch in perceived number of processes between the process manager and this queue
    }

    emptyProcessObj.id = id;

    if (!(this.#queueHead instanceof Process)) {
      this.#queueHead = this.#queueTail = emptyProcessObj;

      //queue length is 0
    } else {
      //works for queues with a length of 1 because the head and tail will be a reference to the same single node
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

      //if the queue is empty. However, don't throw an error,
      //rather return null for control flow
    }

    const shiftedNode = this.#queueHead;

    if (this.#queueHead === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //queue length of 1
    } else {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //queue length >1
    }

    const id = shiftedNode.id; //ensures usage of a copy rather than a reference

    this.#processesInQueue.delete(id as string);
    this.#collectProcessObj(shiftedNode);

    return id;
  }

  //determines how to alter the queue to remove he supplied process instance from such.
  remove(id: string): void {
    checkType(id, "string");

    const fetchedNode = this.#processesInQueue.get(id);

    if (!fetchedNode) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR

      //to ensure that the process trying to be removed is actually in the queue
    }

    if (fetchedNode === this.#queueHead && fetchedNode === this.#queueTail) {
      this.#queueHead = this.#queueTail = null;

      //if the node is both the head and tail (queue length of 1)
    } else if (fetchedNode === this.#queueHead) {
      this.#queueHead = this.#queueHead.next;
      this.#queueHead!.previous = null;

      //if the node is the current head (length >1)
    } else if (fetchedNode === this.#queueTail) {
      this.#queueTail = this.#queueTail.previous;
      this.#queueTail!.next = null;

      //if the node is the current tail (length >1)
    } else {
      fetchedNode.previous!.next = fetchedNode.next;
      fetchedNode.next!.previous = fetchedNode.previous;

      //if the node is in the middle of the queue (length >2)
    }

    this.#processesInQueue.delete(id);
    this.#collectProcessObj(fetchedNode);
  }
}

class ProcessManager {
  #pageSource: string;
  #childProcesses: Map<string, ChildProcess> = new Map<string, ChildProcess>();
  #processQueue: ProcessQueue;
  #subscriber: Function | null = null;

  constructor(pageSource: string, numOfProcesses: number) {
    checkType(pageSource, "string");
    checkType(numOfProcesses, "positiveInteger");

    this.#pageSource = pageSource;
    this.#processQueue = new ProcessQueue(numOfProcesses);
  }

  //uses null args in order to avoid say using an object and thus reading optional properties.
  //This means the args will be allocated on the stack unless explicitly an object argument.
  //Trying to reduce object creation where I can.
  #emit(
    event: string,
    processId: string,
    message: Serializable | null = null,
    code: number | null = null,
    signal: string | number | null = null
  ): void {
    //only checking this value, because it will be for proper state checking of the encompassing state machine.
    //also, the other args are checked in the #initChildProcess method anyway
    checkType(this.#subscriber, "function");

    (this.#subscriber as Function)(event, processId, message, code, signal);
  }

  #initChildProcess(processId: string): Promise<null> {
    checkType(processId, "string");

    const classScope = this;

    return new Promise((resolve, reject) => {
      const childProcess = fork(classScope.#pageSource);

      this.#childProcesses.set(processId, childProcess);

      childProcess.on("exit", (code, signal) => {
        classScope.#processQueue.remove(processId);
        classScope.#childProcesses.delete(processId);

        this.#emit("exit", processId, null, code, signal);

        //emit the event to alert the parent class 'SmartCluster' that a process exited, and to thus
        //invoke the necessary apis for process and task recovery. This should cover all cases where a process exits,
        //which includes crashes.
      });

      childProcess.on("error", (err) => {
        reject(err); //app breaking exception
      });

      childProcess.on("message", (message) => {
        this.#emit("message", processId, message, null, null);

        //emit the event to alert the parent class 'SmartCluster' that the process finished a task, and to
        //thus invoke the necessary apis to either send the corresponding process on the next available task, or to add the process
        //to the process queue.
      });

      childProcess.on("spawn", () => {
        this.#emit("spawn", processId, null, null, null);
        //emit the event to alert the parent class 'SmartCluster' that the process has spawned completely and is ready to
        //be used, and to thus invoke the necessary apis to either give the new process a task, or to add the process to the
        //process queue.

        resolve(null); //resolves the ovearching promise, which is important for child process initialization.
      });
    });
  }

  subscribe(subFunc: Function): void {
    checkType(subFunc, "function");

    this.#subscriber = subFunc;
  }

  async createProcess(): Promise<string> {
    let processId: string;

    do {
      processId = nanoid();

      //ensures no collision of IDs, even if the chance is really small
    } while (!this.#childProcesses.get(processId)); //get() is faster than has()

    await this.#initChildProcess(processId);

    return processId; //will be used by the encompassing smart cluster class for identification matching of events emitted.
  }

  killProcess(processId: string): void {
    checkType(processId, "string");

    const process = this.#childProcesses.get(processId);

    if (!process) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    process.kill();
  }

  addToQueue(processId: string): void {
    checkType(processId, "string");

    if (!this.#childProcesses.get(processId)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#processQueue.add(processId);
  }

  getNextProcessId(): string | null {
    return this.#processQueue.shift();

    //if an ID is returned, it was removed from the queue on the shift
  }

  sendToProcess(
    processId: string,
    taskId: string,
    taskLabel: string,
    args: Array<any>
  ): void {
    checkType(processId, "string");
    checkType(taskId, "string");
    checkType(taskLabel, "string");
    checkType(args, "array");

    const childProcess = this.#childProcesses.get(processId);

    if (!childProcess) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    childProcess.send({ taskId, taskLabel, args });
  }
}

class Task {
  id: string | null = null;
  isPreallocated: boolean;
  next: Task | null = null;
  previous: Task | null = null;

  constructor(isPreallocated: boolean) {
    this.isPreallocated = isPreallocated;
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
  #preallocatedObjs: number;
  #maxObjs: number;
  #currSumOfObjs: number = 0;

  #tasksInQueue: Map<string, Task> = new Map<string, Task>();

  constructor(preallocatedObjs: number = 0, maxObjs: number = 0) {
    checkType(preallocatedObjs, "positiveInteger");
    checkType(maxObjs, "positiveInteger");

    if (preallocatedObjs > maxObjs) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#preallocatedObjs = preallocatedObjs;
    this.#maxObjs = maxObjs;

    for (let i = 0; i < this.#preallocatedObjs; i++) {
      this.#emptyTaskObjs.push(new Task(true));
      this.#currSumOfObjs++;
    }
  }

  #collectTaskObj(task: Task): void {
    if (!(task instanceof Task)) {
      throw new Error();
    }

    task.clearIdAndPointers();

    if (task.isPreallocated) {
      this.#emptyTaskObjs.push(task);

      //means the task object supplied was an original preallocated object, so return
      //it to the empty task object array for a better chance at cache locality optimization.
    } else {
      this.#currSumOfObjs--;
      //means the current objects value has to be greater than the preallocated objects value
    }
  }

  #getTaskObj(): Task {
    if (this.#currSumOfObjs >= this.#maxObjs) {
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

      this.#currSumOfObjs++;

      return created;

      //in this case, create a new object that exceeds the prealloc limit, but not the max, because there aren't
      //any task objects that can be reused at this point.
    }
  }

  add(taskId: string): void {
    checkType(taskId, "string");

    //get() is faster than has()
    if (this.#tasksInQueue.get(taskId)) {
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

    this.#tasksInQueue.set(taskId, taskObj);
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

  remove(taskId: string): void {
    checkType(taskId, "string");

    const task = this.#tasksInQueue.get(taskId);

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

    this.#tasksInQueue.delete(taskId);
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

  constructor(preallocatedObjs: number, maxObjs: number) {
    checkType(preallocatedObjs, "positiveInteger");
    checkType(maxObjs, "positiveInteger");

    if (maxObjs < preallocatedObjs) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#taskQueue = new TaskQueue(preallocatedObjs, maxObjs);
  }

  //returns the id string corresponding to the created task
  createTask(taskLabel: string, args: Array<any>): string {
    checkType(taskLabel, "string");
    checkType(args, "array");

    let taskId: string;

    do {
      taskId = nanoid();

      //ensures no collision of IDs, even if the chance is really small
    } while (!this.#taskLabels.get(taskId)); //get() is faster than has()

    this.#taskLabels.set(taskId, taskLabel);
    this.#taskArgs.set(taskId, args);

    return taskId;
  }

  addToQueue(taskId: string): void {
    checkType(taskId, "string");

    //get() is faster than has()
    if (!this.#taskLabels.get(taskId)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    //the task added to queue cannot already exist within the queue
    this.#taskQueue.add(taskId);
  }

  getNextTaskId(): string | null {
    //if an ID is returned, it was removed from the queue on the shift
    return this.#taskQueue.shift();
  }

  deleteTask(taskId: string): void {
    checkType(taskId, "string");

    if (!this.#taskLabels.get(taskId)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#taskQueue.remove(taskId);
    this.#taskLabels.delete(taskId);
    this.#taskArgs.delete(taskId);
  }

  requeueTask(taskId: string): void {
    checkType(taskId, "string");

    if (!this.#taskLabels.get(taskId)) {
      throw new Error(); //STILL NEED TO ADD CUSTOM ERROR
    }

    this.#taskQueue.remove(taskId);
    this.#taskQueue.add(taskId);
  }

  getTaskLabel(taskId: string): string | null {
    checkType(taskId, "string");

    const taskLabel = this.#taskLabels.get(taskId);

    return taskLabel ? taskLabel : null;
  }

  getTaskArgs(taskId: string): Array<any> | null {
    checkType(taskId, "string");

    const args = this.#taskArgs.get(taskId);

    return Array.isArray(args) ? [...args] : null; //return a clone of the array instead of the reference
  }
}

class SmartCluster {
  //for managing each task promise created, which these promises are delegated to the child processes,
  //automatically managing load balancing. The key is the arbitrary promise ID, and the value is the promise APIs resolve and reject.
  //The promise ID is passed to the child, paired with the task to execute. The child process passes this same promise ID back, which allows
  //messages to main process to be associated with specific promises.
  #messagePromises: Map<string, Promise<any>> = new Map();

  //stores the semantics between a process and what task it is currently handling.
  #processIdToTaskId: Map<string, string> = new Map<string, string>();

  #processManager: ProcessManager;
  #taskManager: TaskManager;

  constructor(
    pageSource: string,
    numOfProcesses: number,
    preallocatedObjs: number,
    maxObjs: number
  ) {
    this.#processManager = new ProcessManager(pageSource, numOfProcesses);
    this.#taskManager = new TaskManager(preallocatedObjs, maxObjs);

    //since this operation is synchronous, it will occur prior to the execution of the callbacks supplied
    //to the event emitters returned from fork.
    this.#processManager.subscribe(this.#listener.bind(this));
  }

  //acts as the entrypoint for listening to events emitted from the child process event emitters.
  //This will be important for choreographing necessary state behaviors, such as auto creating a new process
  //after a previous process crashed. The course of action is defined conditionally using the supplied args.
  #listener(
    event: string,
    processId: string,
    message: Serializable | null = null,
    code: number | null = null,
    signal: string | number | null = null
  ) {}

  async sendTask(taskLabel: string, args: Array<any>): Promise<any> {
    
  }
}
