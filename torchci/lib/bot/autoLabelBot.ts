import { Context, Probot } from "probot";

const titleRegexToLabel: [RegExp, string][] = [
  [/rocm/gi, "module: rocm"],
  [/DISABLED\s+test.*\(.*\)/g, "skipped"],
  [/\[PyTorch Edge\]/gi, "release notes: mobile"],
  [/caffe2/g, "caffe2"],
  [/\[codemod\]/gi, "topic: not user facing"],
];

const filenameRegexToLabel: [RegExp, string][] = [
  // releng
  [/docker\//gi, "release notes: releng"],
  [/.circleci/gi, "release notes: releng"],
  [/.github/gi, "release notes: releng"],
  [/.jenkins/gi, "release notes: releng"],
  [/.azure_pipelines/gi, "release notes: releng"],
  // dataloader_frontend => does that correlate best with release notes: AO frontend?
  [/torch\/utils\/data/gi, "module: dataloader"],
  [/test_data(loader|pipe)/gi, "module: dataloader"],
  // cpp_frontend => not a real category either
  [/torch\/(csrc|cpp)\/api/gi, "module: dataloader"],
  // distributed + its flavors
  [/c10d/gi, "release notes: distributed (c10d)"],
  [/distributed.*sharded/gi, "release notes: distributed (sharded)"],
  [/distributed.*ddp/gi, "release notes: distributed (ddp)"],
  [/distributed.*pipeline/gi, "release notes: distributed (pipeline)"],
  [/distributed.*fsdp/gi, "release notes: distributed (fsdp)"],
  [/distributed.*rpc/gi, "release notes: distributed (rpc)"],
  // vulkan
  [/vulkan/gi, "release notes: vulkan"],
  // foreach_frontend
  [/foreach/gi, "release notes: foreach_frontend"],
  // onnx
  [/onnx/gi, "release notes: onnx"],
  // fx
  [/torch\/fx/gi, "release notes: fx"],
  [/test_fx/gi, "release notes: fx"],
  // ao
  [/(torch|test)\/ao/gi, "release notes: AO frontend"],
  // quantization
  [/(torch|test)\/quantization/gi, "release notes: quantization"],
  [/aten\/src\/ATen\/native\/quantized/gi, "release notes: quantization"],
  [/torch\/nn\/quantiz(ed|able)/gi, "release notes: quantization"],
  // package => is this supposed to be package/deploy?
  [/(torch|test)\/package/gi, "release notes: package/deploy"],
  // mobile
  [/torch\/csrc\/jit\/mobile/gi, "release notes: mobile"],
  [/aten\/src\/ATen\/native\/metal/gi, "release notes: mobile"],
  [/test\/mobile/gi, "release notes: mobile"],
  [/torch\/backends\/_nnapi\//gi, "release notes: mobile"],
  [/test\/test_nnapi.py/gi, "release notes: mobile"],
  // linalg_frontend
  [/aten\/src\/ATen\/native\/LinearAlgebra.cpp/gi, "release notes: linalg_frontend"],
  [/test\/test_linalg.py/gi, "release notes: linalg_frontend"],
  [/torch\/linalg/gi, "release notes: linalg_frontend"],
  // sparse_frontend => also did not exist
  [/aten\/src\/ATen\/native\/sparse/gi, "module: sparse"],
  [/torch\/sparse/gi, "module: sparse"],
  [/torch\/_masked\/__init__.py/gi, "module: sparse"],
  // autograd_frontend => also did not exist
  [/tools\/autograd/gi, "module: autograd"],
  // nn_frontend => also did not exist
  [/test\/test_nn.py/gi, "module: nn"],
  [/test\/test_module.py/gi, "module: nn"],
  [/tools\/nn\/modules/gi, "module: nn"],
  [/tools\/nn\/functional.py/gi, "module: nn"],
  // jit
  [/torch\/(csrc\/)?jit/gi, "release notes: jit"],
];

function myBot(app: Probot): void {
  function addLabel(
    labelSet: Set<string>,
    newLabels: string[],
    l: string
  ): void {
    if (!labelSet.has(l)) {
      newLabels.push(l);
      labelSet.add(l);
    }
  }

  app.on("issues.labeled", async (context) => {
    // Careful!  For most labels, we only apply actions *when the issue
    // is added*; not if the issue is pre-existing (for example, high
    // priority label results in triage review, but if we unlabel it
    // from triage review, we shouldn't readd triage review the next
    // time the issue is labeled).

    const label = context.payload.label!.name;
    const labels: string[] = context.payload.issue.labels!.map(
      (e) => e["name"]
    );
    context.log({ label, labels });

    const labelSet = new Set(labels);
    const newLabels: string[] = [];

    // NB: Added labels here will trigger more issues.labeled actions,
    // so be careful about accidentally adding a cycle.  With just label
    // addition it's not possible to infinite loop as you will
    // eventually quiesce, beware if you remove labels though!
    switch (label) {
      case "high priority":
      case "critical":
        addLabel(labelSet, newLabels, "triage review");
        break;
    }

    if (newLabels.length) {
      await context.octokit.issues.addLabels(
        context.issue({ labels: newLabels })
      );
    }
  });

  function getLabelsToAddFromTitle(
    title: string,
  ): string[] {
    const labelsToAdd: string[] = [];

    for (const [regex, label] of titleRegexToLabel) {
      if (title.match(regex)) {
        labelsToAdd.push(label);
      }
    }

    return labelsToAdd;
  }

  // from the code, it seems like category can only be one thing, but this function definitely
  // just adds whatever matches. this can be changed to just add one category though, but I'm
  // sure if that was intentionally in the first place.
  // https://github.com/pytorch/pytorch/blob/master/scripts/release_notes/commitlist.py#L90
  function getLabelsToAddFromFilesChanged(
    filesChanged: string[],
  ): string[] {
    const labelsToAdd: string[] = [];

    // used to determine if category cuda
    let isCUDAOnly = filesChanged.length > 0;

    for(const file of filesChanged) {
      // check for typical matches
      for (const [regex, label] of filenameRegexToLabel) {
        if (file.match(regex)) {
          labelsToAdd.push(label);
          // break on first label added
          break;
        }
      }

      if (!file.endsWith(".cu") && !file.endsWith(".cuh")) {
        isCUDAOnly = false;
      }
    }

    if (isCUDAOnly) {
      labelsToAdd.push("release notes: cuda");
    }

    // OpInfo related
    if (filesChanged.length === 1 &&
        (filesChanged.at(0)?.includes("torch/testing/_internal/common_methods_invocations.py") ||
        filesChanged.at(0)?.includes("torch/_torch_docs.py"))) {
          labelsToAdd.push("release notes: python_frontend")
    }

    return labelsToAdd;
  }

  async function addNewLabels(existingLabels: string[], labelsToAdd: string[], context: Context): Promise<void> {
    // labelsToAdd may have duplicates, so we cannot use a filter
    const newLabels: string[] = []
    labelsToAdd.forEach(l => {
      if (!existingLabels.includes(l) && !newLabels.includes(l)) {
        newLabels.push(l);
      }
    });

    if (newLabels.length) {
      context.log(`Adding new labels: ${newLabels}}`);
      await context.octokit.issues.addLabels(
        context.issue({ labels: newLabels })
      );
    }
  }

  app.on(["issues.opened", "issues.edited"], async (context) => {
    const labels: string[] = context.payload.issue.labels!.map(
      (e) => e["name"]
    );
    const title = context.payload["issue"]["title"];
    context.log({ labels, title });

    const labelsToAdd = getLabelsToAddFromTitle(title);
    await addNewLabels(labels, labelsToAdd, context);
  });

  app.on(["pull_request.opened", "pull_request.edited"], async (context) => {
    const labels: string[] = context.payload.pull_request.labels.map(
      (e) => e["name"]
    );
    const title = context.payload.pull_request.title;
    const filesChangedRes = await context.octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
      owner: context.payload.repository.owner.name!,
      repo: context.payload.repository.name,
      pull_number: context.payload.pull_request.number
    })
    const filesChanged = filesChangedRes.map((f: any) => f.filename);
    context.log({ labels, title, filesChanged });

    const labelsToAdd = getLabelsToAddFromTitle(title).concat(getLabelsToAddFromFilesChanged(filesChanged));
    await addNewLabels(labels, labelsToAdd, context);
  });
}

export default myBot;
