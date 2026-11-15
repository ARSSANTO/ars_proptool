export interface Bone {
  name: string;
  id: number;
}

// The client checks every id against the ped when the editor opens and prints the ones it does not have.
export const BONES: Bone[] = [
  { name: 'SKEL_ROOT', id: 0 },
  { name: 'SKEL_Pelvis', id: 11816 },
  { name: 'SKEL_Spine_Root', id: 57597 },
  { name: 'SKEL_Spine0', id: 23553 },
  { name: 'SKEL_Spine1', id: 24816 },
  { name: 'SKEL_Spine2', id: 24817 },
  { name: 'SKEL_Spine3', id: 24818 },
  { name: 'SKEL_Neck_1', id: 39317 },
  { name: 'RB_Neck_1', id: 35731 },
  { name: 'SKEL_Head', id: 31086 },

  { name: 'SKEL_L_Clavicle', id: 64729 },
  { name: 'SKEL_L_UpperArm', id: 45509 },
  { name: 'SKEL_L_Forearm', id: 61163 },
  { name: 'SKEL_L_Hand', id: 18905 },
  { name: 'PH_L_Hand', id: 60309 },
  { name: 'SKEL_R_Clavicle', id: 10706 },
  { name: 'SKEL_R_UpperArm', id: 40269 },
  { name: 'SKEL_R_Forearm', id: 28252 },
  { name: 'SKEL_R_Hand', id: 57005 },
  { name: 'PH_R_Hand', id: 28422 },

  { name: 'SKEL_L_Finger00', id: 26610 },
  { name: 'SKEL_L_Finger01', id: 4089 },
  { name: 'SKEL_L_Finger02', id: 4090 },
  { name: 'SKEL_L_Finger10', id: 26611 },
  { name: 'SKEL_L_Finger11', id: 4169 },
  { name: 'SKEL_L_Finger12', id: 4170 },
  { name: 'SKEL_L_Finger20', id: 26612 },
  { name: 'SKEL_L_Finger21', id: 4185 },
  { name: 'SKEL_L_Finger22', id: 4186 },
  { name: 'SKEL_L_Finger30', id: 26613 },
  { name: 'SKEL_L_Finger31', id: 4137 },
  { name: 'SKEL_L_Finger32', id: 4138 },
  { name: 'SKEL_L_Finger40', id: 26614 },
  { name: 'SKEL_L_Finger41', id: 4153 },
  { name: 'SKEL_L_Finger42', id: 4154 },

  { name: 'SKEL_R_Finger00', id: 58866 },
  { name: 'SKEL_R_Finger01', id: 64016 },
  { name: 'SKEL_R_Finger02', id: 64017 },
  { name: 'SKEL_R_Finger10', id: 58867 },
  { name: 'SKEL_R_Finger11', id: 64096 },
  { name: 'SKEL_R_Finger12', id: 64097 },
  { name: 'SKEL_R_Finger20', id: 58868 },
  { name: 'SKEL_R_Finger21', id: 64112 },
  { name: 'SKEL_R_Finger22', id: 64113 },
  { name: 'SKEL_R_Finger30', id: 58869 },
  { name: 'SKEL_R_Finger31', id: 64064 },
  { name: 'SKEL_R_Finger32', id: 64065 },
  { name: 'SKEL_R_Finger40', id: 58870 },
  { name: 'SKEL_R_Finger41', id: 64080 },
  { name: 'SKEL_R_Finger42', id: 64081 },

  { name: 'SKEL_L_Thigh', id: 58271 },
  { name: 'SKEL_L_Calf', id: 63931 },
  { name: 'SKEL_L_Foot', id: 14201 },
  { name: 'SKEL_L_Toe0', id: 2108 },
  { name: 'MH_L_Knee', id: 46078 },
  { name: 'PH_L_Foot', id: 65245 },
  { name: 'SKEL_R_Thigh', id: 51826 },
  { name: 'SKEL_R_Calf', id: 36864 },
  { name: 'SKEL_R_Foot', id: 52301 },
  { name: 'SKEL_R_Toe0', id: 20781 },
  { name: 'MH_R_Knee', id: 16335 },
  { name: 'PH_R_Foot', id: 57717 },
];

const BY_ID = new Map(BONES.map((bone) => [bone.id, bone]));

export const boneName = (id: number): string => BY_ID.get(id)?.name ?? `Bone ${id}`;
export const boneIds = (): number[] => BONES.map((bone) => bone.id);
