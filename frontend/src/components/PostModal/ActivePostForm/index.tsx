// postModal/ActivePostForm/index.tsx
import MediaPostForm from "./MediaPostForm";
import TextPostForm from "./TextPostForm";
import ModelPostForm from "./ModelPostForm"
// later: import ModelPostForm from "./ModelPostForm";

import { PostType } from "../../../types/postTypes";

const postFormRegistry: Record<
  PostType,
  React.FC<{ onCancel: () => void }>
> = {
  model: ModelPostForm,
  media: MediaPostForm,
  game: TextPostForm,
};

const ActivePostForm = ({
  postType,
  onCancel,
}: {
  postType: PostType;
  onCancel: () => void;
}) => {
  const FormComponent = postFormRegistry[postType];
  return <FormComponent onCancel={onCancel} />;
};

export default ActivePostForm;
